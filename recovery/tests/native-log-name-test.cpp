#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "../native-log-name.h"
#include <cassert>
#include <iostream>
int main(){
    SYSTEMTIME when{};when.wYear=2026;when.wMonth=10;when.wDay=12;
    const auto root=std::filesystem::path(L"C:\\Fixture\\Logs");
    auto path=BeipLogName::resolve(root,L"%SERVER%\\%character%-%date%.html",L"yyyyMMdd",L"World/name",L"Alice",false,&when);
    assert(path==root/L"World_name\\Alice-20261012.html");
    assert(BeipLogName::resolve(root,L"session",L"yyyy-MM-dd",L"W",L"C",true,&when)==root/L"session - 2026-10-12.txt");
    assert(BeipLogName::resolve(root,L"D:\\Chosen\\session.log",L"yyyyMMdd",L"W",L"C",false,&when)==L"D:\\Chosen\\session.log");
    for(auto bad:{L"..\\outside.txt",L"C:relative.txt",L"\\\\server\\share\\log.txt",L"CON.txt",L"NUL.foo.txt",L"folder\\bad:stream.txt",L"program.exe",L"file. "}){
        bool rejected=false;try{BeipLogName::resolve(root,bad,L"yyyyMMdd",L"W",L"C",false,&when);}catch(const std::invalid_argument&){rejected=true;}assert(rejected);
    }
    std::cout<<"PASS native original-style log tokens, date suffix, local paths and invalid path rejection\n";
}
