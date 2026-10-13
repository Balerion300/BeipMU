#pragma once
#include <windows.h>
#include <mmsystem.h>
#include <commdlg.h>
#include <sapi.h>
#include <wrl.h>
#include <filesystem>
#include <functional>
#include <cstring>
#include <string>
#include <unordered_map>
#include <unordered_set>
#pragma comment(lib, "winmm.lib")
#pragma comment(lib, "sapi.lib")
#pragma comment(lib, "comdlg32.lib")

// All methods and SAPI objects live on the window's COM apartment.
class TriggerAudio {
    struct Voice { Microsoft::WRL::ComPtr<ISpVoice> voice; std::unordered_set<ULONG> pending; };
    std::unordered_map<std::string, Voice> voices;
    std::string soundOwner;
    HWND window = nullptr;
    UINT notification = 0;
    std::function<void(const std::string&, const std::string&, const std::string&, ULONG, const std::wstring&)> report;
    void emit(const std::string& owner, const std::string& action, const std::string& status, ULONG stream = 0, const std::wstring& path = {}) {
        if (report) report(owner, action, status, stream, path);
    }
public:
    static constexpr size_t MaxText = 2048, MaxPath = 2048, MaxVoices = 8, MaxPending = 8;
    void initialize(HWND hwnd, UINT message, decltype(report) callback) { window = hwnd; notification = message; report = std::move(callback); }
    static bool validText(const std::wstring& text) {
        if (text.empty() || text.size() > MaxText || text.find_first_not_of(L" \t\r\n") == text.npos) return false;
        for (wchar_t c : text) if ((c < 32 && c != L'\t' && c != L'\r' && c != L'\n') || c == 127) return false;
        return true;
    }
    static bool validPath(const std::wstring& path) {
        if (path.size() < 7 || path.size() > MaxPath || !((path[0] >= L'A' && path[0] <= L'Z') || (path[0] >= L'a' && path[0] <= L'z')) || path[1] != L':' || (path[2] != L'\\' && path[2] != L'/')) return false;
        for (size_t i = 0; i < path.size(); ++i) if (path[i] < 32 || path[i] == 127 || wcschr(L"<>\"|?*", path[i]) || (i != 1 && path[i] == L':')) return false;
        auto p = std::filesystem::path(path);
        for (const auto& part : p) if (part == L".." || part == L".") return false;
        return _wcsicmp(p.extension().c_str(), L".wav") == 0;
    }
    void browse(const std::string& owner) {
        wchar_t path[MaxPath + 1]{};
        OPENFILENAMEW dialog{}; dialog.lStructSize=sizeof(dialog); dialog.hwndOwner=window;
        dialog.lpstrFilter=L"WAV sound files (*.wav)\0*.wav\0\0"; dialog.lpstrFile=path;
        dialog.nMaxFile=DWORD(MaxPath + 1); dialog.lpstrTitle=L"Choose trigger sound";
        dialog.Flags=OFN_FILEMUSTEXIST | OFN_PATHMUSTEXIST | OFN_NOCHANGEDIR | OFN_DONTADDTORECENT;
        if(!GetOpenFileNameW(&dialog)){emit(owner,"browse",CommDlgExtendedError()?"failed":"cancelled");return;}
        if(!validPath(path)){emit(owner,"browse","invalid-path");return;}
        emit(owner,"browse","selected",0,path);
    }
    void sound(const std::string& owner, const std::wstring& path) {
        if (!validPath(path)) { emit(owner,"sound","invalid-path"); return; }
        // Resolve junctions/symlinks before checking the volume; mapped and UNC shares are excluded.
        HANDLE file = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
        if (file == INVALID_HANDLE_VALUE) { emit(owner,"sound","file-unavailable"); return; }
        wchar_t finalPath[4096]{}; DWORD n = GetFinalPathNameByHandleW(file, finalPath, 4096, FILE_NAME_NORMALIZED);
        LARGE_INTEGER size{}; char signature[12]{}; DWORD read = 0;
        bool valid = n > 4 && n < 4096 && std::wstring_view(finalPath).starts_with(L"\\\\?\\") && validPath(finalPath + 4) &&
            GetFileSizeEx(file,&size) && size.QuadPart >= 12 && size.QuadPart <= 32*1024*1024 &&
            ReadFile(file,signature,12,&read,nullptr) && read == 12 && memcmp(signature,"RIFF",4) == 0 && memcmp(signature+8,"WAVE",4) == 0;
        std::wstring resolved = valid ? finalPath + 4 : L"";
        wchar_t volume[4]{valid ? resolved[0] : L'C', L':', L'\\', 0};
        UINT drive = valid ? GetDriveTypeW(volume) : DRIVE_UNKNOWN;
        valid = valid && (drive == DRIVE_FIXED || drive == DRIVE_REMOVABLE || drive == DRIVE_CDROM || drive == DRIVE_RAMDISK);
        if (!valid) { CloseHandle(file); emit(owner,"sound","invalid-local-wav"); return; }
        if (!soundOwner.empty()) emit(soundOwner,"sound","replaced");
        // One bounded asynchronous WAV channel. TRUE means API accepted, not that a listener heard it.
        BOOL accepted = PlaySoundW(resolved.c_str(), nullptr, SND_FILENAME | SND_ASYNC | SND_NODEFAULT);
        CloseHandle(file);
        soundOwner = accepted ? owner : std::string{};
        emit(owner,"sound",accepted ? "api-accepted" : "api-failed");
    }
    void speech(const std::string& owner, const std::wstring& text) {
        if (!validText(text)) { emit(owner,"speech","invalid-text"); return; }
        auto it = voices.find(owner);
        if (it == voices.end()) {
            if (voices.size() >= MaxVoices) { emit(owner,"speech","voice-limit"); return; }
            Voice v;
            HRESULT hr = CoCreateInstance(CLSID_SpVoice,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(v.voice.GetAddressOf()));
            if (FAILED(hr) || FAILED(v.voice->SetNotifyWindowMessage(window,notification,0,0)) ||
                FAILED(v.voice->SetInterest(SPFEI(SPEI_START_INPUT_STREAM) | SPFEI(SPEI_END_INPUT_STREAM), SPFEI(SPEI_START_INPUT_STREAM) | SPFEI(SPEI_END_INPUT_STREAM)))) {
                emit(owner,"speech","unavailable"); return;
            }
            it = voices.emplace(owner,std::move(v)).first;
        }
        auto& v = it->second;
        if (v.pending.size() >= MaxPending) { emit(owner,"speech","queue-full"); return; }
        ULONG stream = 0;
        // Force literal text: trigger captures cannot supply SAPI XML or audio resource markup.
        HRESULT hr = v.voice->Speak(text.c_str(), SPF_ASYNC | SPF_IS_NOT_XML, &stream);
        if (FAILED(hr)) { emit(owner,"speech","api-failed"); return; }
        v.pending.insert(stream); emit(owner,"speech","queued",stream);
    }
    void poll() {
        for (auto& [owner,v] : voices) {
            SPEVENT event{};
            while (v.voice->GetEvents(1,&event,nullptr) == S_OK) {
                if (v.pending.count(event.ulStreamNum)) {
                    if (event.eEventId == SPEI_START_INPUT_STREAM) emit(owner,"speech","started",event.ulStreamNum);
                    if (event.eEventId == SPEI_END_INPUT_STREAM) { v.pending.erase(event.ulStreamNum); emit(owner,"speech","ended",event.ulStreamNum); }
                }
                if(event.elParamType == SPET_LPARAM_IS_TOKEN || event.elParamType == SPET_LPARAM_IS_OBJECT) {
                    if(event.lParam)reinterpret_cast<IUnknown*>(event.lParam)->Release();
                } else if(event.elParamType == SPET_LPARAM_IS_POINTER || event.elParamType == SPET_LPARAM_IS_STRING) CoTaskMemFree(reinterpret_cast<void*>(event.lParam));
                event = {};
            }
        }
    }
    void stop(const std::string& owner) {
        if (soundOwner == owner) { PlaySoundW(nullptr,nullptr,0); soundOwner.clear(); emit(owner,"sound","stopped"); }
        if (auto it = voices.find(owner); it != voices.end()) {
            it->second.voice->Speak(nullptr,SPF_PURGEBEFORESPEAK | SPF_ASYNC,nullptr);
            voices.erase(it); emit(owner,"speech","stopped");
        }
        emit(owner,"stop","complete");
    }
    void shutdown() {
        while (!voices.empty()) { auto owner = voices.begin()->first; stop(owner); }
        if (!soundOwner.empty()) { auto owner = soundOwner; stop(owner); }
    }
};
