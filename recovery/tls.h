#pragma once
// Schannel TLS client for an already connected blocking Winsock socket.
// The caller owns the socket, serializes writes, and must shut it down before
// destroying this stream while another thread may be inside recv().
#ifndef SECURITY_WIN32
#define SECURITY_WIN32
#endif
#include <winsock2.h>
#include <windows.h>
#include <security.h>
#include <schannel.h>
#include <algorithm>
#include <chrono>
#include <climits>
#include <cstdio>
#include <cstring>
#include <string>
#include <string_view>
#include <vector>

namespace BeipTLS {
class Stream {
    SOCKET socket_ = INVALID_SOCKET;
    CredHandle credentials_{};
    CtxtHandle context_{};
    bool haveCredentials_ = false, haveContext_ = false, ready_ = false;
    SecPkgContext_StreamSizes sizes_{};
    std::vector<char> encrypted_;
    std::string plaintext_;
    size_t plainOffset_ = 0;

    bool sendAll(const char* data, size_t count) {
        while (count) {
            int n = ::send(socket_, data, int(std::min<size_t>(count, INT_MAX)), 0);
            if (n <= 0) return false;
            data += n; count -= size_t(n);
        }
        return true;
    }
    static std::string statusText(SECURITY_STATUS status) {
        char hex[64]; sprintf_s(hex, "Schannel error 0x%08lx", static_cast<unsigned long>(status));
        return hex;
    }
    bool receiveHandshake(std::chrono::steady_clock::time_point deadline, std::string& error) {
        char chunk[16384];
        while (std::chrono::steady_clock::now() < deadline) {
            int n = ::recv(socket_, chunk, sizeof chunk, 0);
            if (n > 0) {
                if (encrypted_.size() + size_t(n) > 262144) { error = "TLS handshake is too large."; return false; }
                encrypted_.insert(encrypted_.end(), chunk, chunk + n);
                return true;
            }
            if (n == 0) { error = "Server closed during TLS handshake."; return false; }
            int code = WSAGetLastError();
            if (code != WSAETIMEDOUT && code != WSAEWOULDBLOCK) {
                error = "Socket error during TLS handshake."; return false;
            }
        }
        error = "TLS handshake timed out.";
        return false;
    }
public:
    Stream() = default;
    Stream(const Stream&) = delete;
    Stream& operator=(const Stream&) = delete;
    ~Stream() { reset(); }

    void reset() {
        ready_ = false;
        if (haveContext_) { DeleteSecurityContext(&context_); haveContext_ = false; }
        if (haveCredentials_) { FreeCredentialsHandle(&credentials_); haveCredentials_ = false; }
        SecInvalidateHandle(&context_); SecInvalidateHandle(&credentials_);
        socket_ = INVALID_SOCKET; encrypted_.clear(); plaintext_.clear(); plainOffset_ = 0;
        sizes_ = {};
    }
    bool ready() const { return ready_; }

    bool handshake(SOCKET socket, const std::wstring& host, std::string& error) {
        reset(); error.clear();
        if (socket == INVALID_SOCKET || host.empty() || host.size() > 253 ||
            host.find(L'\0') != std::wstring::npos) {
            error = "Invalid TLS server name or socket."; return false;
        }
        socket_ = socket;
        SCHANNEL_CRED policy{};
        policy.dwVersion = SCHANNEL_CRED_VERSION;
        policy.dwFlags = SCH_CRED_AUTO_CRED_VALIDATION | SCH_USE_STRONG_CRYPTO;
        TimeStamp expiry{};
        SECURITY_STATUS status = AcquireCredentialsHandleW(nullptr,
            const_cast<wchar_t*>(UNISP_NAME_W), SECPKG_CRED_OUTBOUND,
            nullptr, &policy, nullptr, nullptr, &credentials_, &expiry);
        if (status != SEC_E_OK) { error = statusText(status); reset(); return false; }
        haveCredentials_ = true;

        constexpr ULONG flags = ISC_REQ_STREAM | ISC_REQ_CONFIDENTIALITY |
            ISC_REQ_REPLAY_DETECT | ISC_REQ_SEQUENCE_DETECT | ISC_REQ_ALLOCATE_MEMORY;
        auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(15);
        bool first = true;
        while (std::chrono::steady_clock::now() < deadline) {
            if (!first && encrypted_.empty() && !receiveHandshake(deadline, error)) { reset(); return false; }
            SecBuffer inputBuffers[2]{};
            SecBufferDesc inputDesc{SECBUFFER_VERSION, 2, inputBuffers};
            if (!first) {
                inputBuffers[0] = {ULONG(encrypted_.size()), SECBUFFER_TOKEN, encrypted_.data()};
                inputBuffers[1] = {0, SECBUFFER_EMPTY, nullptr};
            }
            SecBuffer output{0, SECBUFFER_TOKEN, nullptr};
            SecBufferDesc outputDesc{SECBUFFER_VERSION, 1, &output};
            ULONG attributes = 0;
            status = InitializeSecurityContextW(&credentials_, first ? nullptr : &context_,
                const_cast<wchar_t*>(host.c_str()), flags, 0, SECURITY_NATIVE_DREP,
                first ? nullptr : &inputDesc, 0, &context_, &outputDesc, &attributes, &expiry);
            if (first && (status == SEC_E_OK || status == SEC_I_CONTINUE_NEEDED ||
                status == SEC_I_COMPLETE_NEEDED || status == SEC_I_COMPLETE_AND_CONTINUE)) haveContext_ = true;
            if (status == SEC_I_COMPLETE_NEEDED || status == SEC_I_COMPLETE_AND_CONTINUE) {
                SECURITY_STATUS completion = CompleteAuthToken(&context_, &outputDesc);
                if (completion != SEC_E_OK) status = completion;
                else status = status == SEC_I_COMPLETE_NEEDED ? SEC_E_OK : SEC_I_CONTINUE_NEEDED;
            }
            if (status == SEC_E_INCOMPLETE_MESSAGE) {
                if (output.pvBuffer) FreeContextBuffer(output.pvBuffer);
                if (!receiveHandshake(deadline, error)) { reset(); return false; }
                continue;
            }
            if (status != SEC_E_OK && status != SEC_I_CONTINUE_NEEDED) {
                if (output.pvBuffer) FreeContextBuffer(output.pvBuffer);
                error = statusText(status); reset(); return false;
            }
            bool sent = !output.cbBuffer || (output.pvBuffer && sendAll(
                static_cast<const char*>(output.pvBuffer), output.cbBuffer));
            if (output.pvBuffer) FreeContextBuffer(output.pvBuffer);
            if (!sent) { error = "Could not send TLS handshake data."; reset(); return false; }

            if (!first) {
                if (inputBuffers[1].BufferType == SECBUFFER_EXTRA &&
                    inputBuffers[1].cbBuffer <= encrypted_.size()) {
                    encrypted_.erase(encrypted_.begin(), encrypted_.end() - inputBuffers[1].cbBuffer);
                } else encrypted_.clear();
            }
            first = false;
            if (status == SEC_E_OK) {
                status = QueryContextAttributesW(&context_, SECPKG_ATTR_STREAM_SIZES, &sizes_);
                if (status != SEC_E_OK || !sizes_.cbMaximumMessage ||
                    sizes_.cbMaximumMessage > 262144) {
                    error = "Could not obtain TLS stream sizes."; reset(); return false;
                }
                ready_ = true; return true;
            }
        }
        error = "TLS handshake timed out."; reset(); return false;
    }

    int send(std::string_view text) {
        if (!ready_) { WSASetLastError(WSAENOTCONN); return SOCKET_ERROR; }
        size_t sent = 0;
        while (!text.empty()) {
            size_t length = std::min<size_t>(text.size(), sizes_.cbMaximumMessage);
            std::vector<char> frame(size_t(sizes_.cbHeader) + length + sizes_.cbTrailer);
            std::memcpy(frame.data() + sizes_.cbHeader, text.data(), length);
            SecBuffer buffers[4]{};
            buffers[0] = {sizes_.cbHeader, SECBUFFER_STREAM_HEADER, frame.data()};
            buffers[1] = {ULONG(length), SECBUFFER_DATA, frame.data() + sizes_.cbHeader};
            buffers[2] = {sizes_.cbTrailer, SECBUFFER_STREAM_TRAILER,
                frame.data() + sizes_.cbHeader + length};
            buffers[3] = {0, SECBUFFER_EMPTY, nullptr};
            SecBufferDesc desc{SECBUFFER_VERSION, 4, buffers};
            if (EncryptMessage(&context_, 0, &desc, 0) != SEC_E_OK) {
                WSASetLastError(WSAECONNABORTED); return SOCKET_ERROR;
            }
            size_t wireLength = size_t(buffers[0].cbBuffer) + buffers[1].cbBuffer + buffers[2].cbBuffer;
            if (!sendAll(frame.data(), wireLength)) return SOCKET_ERROR;
            text.remove_prefix(length); sent += length;
        }
        return int(sent);
    }

    int recv(char* destination, int capacity) {
        if (!ready_ || !destination || capacity <= 0) {
            WSASetLastError(WSAEINVAL); return SOCKET_ERROR;
        }
        if (plainOffset_ < plaintext_.size()) {
            size_t length = std::min<size_t>(capacity, plaintext_.size() - plainOffset_);
            std::memcpy(destination, plaintext_.data() + plainOffset_, length);
            plainOffset_ += length;
            if (plainOffset_ == plaintext_.size()) { plaintext_.clear(); plainOffset_ = 0; }
            return int(length);
        }
        for (;;) {
            if (!encrypted_.empty()) {
                SecBuffer buffers[4]{};
                buffers[0] = {ULONG(encrypted_.size()), SECBUFFER_DATA, encrypted_.data()};
                for (int i = 1; i < 4; ++i) buffers[i].BufferType = SECBUFFER_EMPTY;
                SecBufferDesc desc{SECBUFFER_VERSION, 4, buffers};
                SECURITY_STATUS status = DecryptMessage(&context_, &desc, 0, nullptr);
                if (status == SEC_I_CONTEXT_EXPIRED) return 0;
                if (status == SEC_I_RENEGOTIATE) {
                    WSASetLastError(WSAEPROTONOSUPPORT); return SOCKET_ERROR;
                }
                if (status != SEC_E_OK && status != SEC_E_INCOMPLETE_MESSAGE) {
                    WSASetLastError(WSAECONNABORTED); return SOCKET_ERROR;
                }
                if (status == SEC_E_OK) {
                    for (const auto& buffer : buffers)
                        if (buffer.BufferType == SECBUFFER_DATA && buffer.cbBuffer)
                            plaintext_.append(static_cast<const char*>(buffer.pvBuffer), buffer.cbBuffer);
                    size_t extra = 0;
                    for (const auto& buffer : buffers)
                        if (buffer.BufferType == SECBUFFER_EXTRA) extra = buffer.cbBuffer;
                    if (extra && extra <= encrypted_.size())
                        encrypted_.erase(encrypted_.begin(), encrypted_.end() - extra);
                    else encrypted_.clear();
                    if (!plaintext_.empty()) return recv(destination, capacity);
                    continue;
                }
            }
            char chunk[16384];
            int n = ::recv(socket_, chunk, sizeof chunk, 0);
            if (n <= 0) return n;
            if (encrypted_.size() + size_t(n) > 262144) {
                WSASetLastError(WSAEMSGSIZE); return SOCKET_ERROR;
            }
            encrypted_.insert(encrypted_.end(), chunk, chunk + n);
        }
    }
};
} // namespace BeipTLS
