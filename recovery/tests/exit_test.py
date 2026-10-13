"""Prove normal /exit saves before native WM_CLOSE and survives a new process."""
import argparse
import json
import pathlib
import subprocess
import time

ROOT = pathlib.Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exe", type=pathlib.Path, default=ROOT / "dist" / "BeipMU-Recovery-0.16" / "BeipMU-Recovery.exe")
    args = parser.parse_args()
    out = ROOT / "test-results" / ("exit-" + time.strftime("%Y%m%d-%H%M%S"))
    out.mkdir(parents=True, exist_ok=False)
    for phase in ("first", "persist"):
        order_path = out / "exit-order.txt"
        order_path.unlink(missing_ok=True)
        (out / "exit-result.json").unlink(missing_ok=True)
        process = subprocess.Popen([str(args.exe.resolve()), "--test-exit", str(out.resolve())])
        try:
            code = process.wait(timeout=30)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
            raise AssertionError("Normal /exit did not close its process")
        assert code == 0, f"Exit status {code}"
        assert not (out / "timeout.txt").exists(), "Native watchdog destroyed the window"
        result = json.loads((out / "exit-result.json").read_text(encoding="utf-8"))
        assert result["phase"] == phase and result["error"] == "", result
        assert result["quitUnknown"], result
        if phase == "persist":
            assert result["restartWorld"] and result["restartPreferences"], result
        order = order_path.read_text(encoding="utf-8").splitlines()
        assert order == ["saved", "exit-request", "WM_CLOSE", "WM_DESTROY"], order
        settings = json.loads((out / "settings.json").read_text(encoding="utf-8"))
        assert settings["preferences"]["fontSize"] == 19
        assert settings["preferences"]["theme"] == "light"
        assert any(w["id"] == "exit-world" and w["notes"] == "Saved by normal /exit" for w in settings["worlds"])
        (out / (phase + "-result.json")).write_text(json.dumps(result, indent=2), encoding="utf-8")
        (out / (phase + "-order.txt")).write_text("\n".join(order) + "\n", encoding="utf-8")
    print("PASS native /exit save/order/process close and restart persistence:", out)


if __name__ == "__main__":
    main()
