#pragma once
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <string>
#include <string_view>
#include <limits>

// Original CodePages.cpp uses Windows conversion flags 0 (including best fit).
// All encoding intermediates are owned, noncopyable, and erased on exit.
namespace BeipEncoding {
enum class Encoding { Utf8, Windows1252, Cp437 };
inline bool parse(std::string_view name,Encoding& out){
    if(name=="utf-8")out=Encoding::Utf8;
    else if(name=="windows-1252")out=Encoding::Windows1252;
    else if(name=="cp437")out=Encoding::Cp437;
    else return false;
    return true;
}
template<class Char> struct SecureString {
    std::basic_string<Char> value;
    SecureString()=default;
    SecureString(const SecureString&)=delete;
    SecureString& operator=(const SecureString&)=delete;
    ~SecureString(){clear();}
    void clear(){if(!value.empty())SecureZeroMemory(value.data(),value.size()*sizeof(Char));value.clear();}
};
using SecureBytes=SecureString<char>;
using SecureWide=SecureString<wchar_t>;

// The caller owns the UTF8 source and must wipe it too if it contains a secret.
inline bool encode(std::string_view text,Encoding encoding,SecureBytes& result){
    result.clear();
    if(text.empty())return true;
    if(text.size()>static_cast<size_t>((std::numeric_limits<int>::max)()))return false;
    const int length=static_cast<int>(text.size());
    const int units=MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text.data(),length,nullptr,0);
    if(!units)return false;
    if(encoding==Encoding::Utf8){result.value.assign(text);return true;}
    const UINT codepage=encoding==Encoding::Windows1252?1252:437;
    SecureWide wide;wide.value.resize(units);
    if(MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,text.data(),length,wide.value.data(),units)!=units)return false;
    const int size=WideCharToMultiByte(codepage,0,wide.value.data(),units,nullptr,0,nullptr,nullptr);
    if(!size)return false;
    result.value.resize(size);
    if(WideCharToMultiByte(codepage,0,wide.value.data(),units,result.value.data(),size,nullptr,nullptr)!=size){result.clear();return false;}
    return true;
}
// Convert ordinary user text first, append its line terminator, then escape IAC.
// Raw Telnet negotiation and GMCP must never use this helper.
inline bool commandWire(std::string_view text,Encoding encoding,SecureBytes& result){
    result.clear();if(text.size()>8192||text.find_first_of("\r\n")!=text.npos)return false;
    SecureBytes encoded;if(!encode(text,encoding,encoded))return false;
    // Reserve once before secret content, avoiding reallocations holding old copies.
    result.value.reserve(encoded.value.size()*2+2);
    for(unsigned char c:encoded.value){result.value+=static_cast<char>(c);if(c==255)result.value+=static_cast<char>(c);}
    result.value+="\r\n";
    return true;
}
}
