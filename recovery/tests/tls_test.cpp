// Loopback Schannel test client. Launch a TLS server on 127.0.0.1 and run:
// tls_test.exe <connect-host> <port> <certificate-host> success|failure
// A success server must answer "pong" to "ping". For failure cases use an
// untrusted certificate or a trusted certificate with a different hostname.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <cstdio>
#include <cstdlib>
#include <string>
#include "../tls.h"

int main(int argc, char** argv) {
    if (argc != 5) {
        std::fputs("usage: tls_test connect-host port certificate-host success|failure\n", stderr);
        return 2;
    }
    WSADATA winsock{};
    if (WSAStartup(MAKEWORD(2, 2), &winsock)) return 2;
    addrinfo hints{}, *addresses = nullptr;
    hints.ai_socktype = SOCK_STREAM;
    SOCKET socket = INVALID_SOCKET;
    if (!getaddrinfo(argv[1], argv[2], &hints, &addresses)) {
        for (auto* address = addresses; address; address = address->ai_next) {
            SOCKET candidate = WSASocketW(address->ai_family, address->ai_socktype,
                address->ai_protocol, nullptr, 0, 0);
            if (candidate == INVALID_SOCKET) continue;
            if (::connect(candidate, address->ai_addr, int(address->ai_addrlen)) == 0) {
                socket = candidate; break;
            }
            closesocket(candidate);
        }
        freeaddrinfo(addresses);
    }
    if (socket == INVALID_SOCKET) { std::fputs("could not connect\n", stderr); WSACleanup(); return 2; }
    DWORD timeout = 500;
    setsockopt(socket, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<char*>(&timeout), sizeof timeout);
    timeout = 2000;
    setsockopt(socket, SOL_SOCKET, SO_SNDTIMEO, reinterpret_cast<char*>(&timeout), sizeof timeout);
    int nameLength = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, argv[3], -1, nullptr, 0);
    std::wstring host(nameLength > 0 ? nameLength : 0, L'\0');
    if (nameLength > 0) {
        MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, argv[3], -1, host.data(), nameLength);
        host.pop_back();
    }
    BeipTLS::Stream tls;
    std::string error;
    bool accepted = tls.handshake(socket, host, error);
    bool expected = std::string(argv[4]) == "success";
    int result = 0;
    if (accepted != expected) {
        std::fprintf(stderr, "TLS result mismatch: accepted=%d expected=%d %s\n",
            accepted, expected, error.c_str());
        result = 1;
    } else if (accepted) {
        char response[4]{};
        int sent = tls.send("ping"), received = tls.recv(response, sizeof response);
        if (sent != 4 || received != 4 || std::string_view(response, 4) != "pong") {
            std::fputs("TLS data exchange failed\n", stderr); result = 1;
        }
    }
    shutdown(socket, SD_BOTH);
    tls.reset();
    closesocket(socket);
    WSACleanup();
    if (!result) std::puts(expected ? "TLS accepted and exchanged data" : "TLS rejected as expected");
    return result;
}
