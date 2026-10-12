#pragma once
// Local original-style log filename expansion. Does not open or truncate files.
#include <windows.h>
#include <filesystem>
#include <string>
#include <string_view>
#include <stdexcept>
#include <algorithm>
#include <cwctype>

namespace BeipLogName {
inline std::wstring lower(std::wstring value){std::transform(value.begin(),value.end(),value.begin(),[](wchar_t c){return wchar_t(std::towlower(c));});return value;}
inline std::wstring component(std::wstring value){
    for(auto& c:value)if(c<32||std::wstring_view(L"\\/:*?\"<>|").find(c)!=std::wstring_view::npos)c=L'_';
    while(!value.empty()&&(value.back()==L'.'||value.back()==L' '))value.pop_back();
    return value.empty()?L"Unnamed":value;
}
inline void replaceToken(std::wstring& value,std::wstring_view token,const std::wstring& replacement){
    size_t offset=0;while(true){auto at=lower(value).find(token,offset);if(at==std::wstring::npos)break;value.replace(at,token.size(),replacement);offset=at+replacement.size();}
}
inline std::filesystem::path resolve(const std::filesystem::path& logsRoot,std::wstring filename,std::wstring dateFormat,const std::wstring& world,const std::wstring& character,bool appendDate,const SYSTEMTIME* suppliedTime=nullptr){
    if(filename.empty()||filename.size()>1024)throw std::invalid_argument("Enter a log filename of at most 1,024 characters.");
    SYSTEMTIME now{};if(suppliedTime)now=*suppliedTime;else GetLocalTime(&now);
    if(dateFormat.empty())dateFormat=L"yyyy'-'MM'-'dd";
    if(dateFormat.size()>80)throw std::invalid_argument("Log date format is too long.");
    wchar_t buffer[256]{};if(!GetDateFormatEx(LOCALE_NAME_USER_DEFAULT,0,&now,dateFormat.c_str(),buffer,256,nullptr))throw std::invalid_argument("Invalid Windows log date format.");
    const std::wstring date=component(buffer);
    const DWORD needed=ExpandEnvironmentStringsW(filename.c_str(),nullptr,0);
    if(!needed||needed>32768)throw std::invalid_argument("Could not expand the log filename.");
    std::wstring expanded(needed,L'\0');if(ExpandEnvironmentStringsW(filename.c_str(),expanded.data(),needed)!=needed)throw std::invalid_argument("Could not expand the log filename.");expanded.resize(needed-1);
    replaceToken(expanded,L"%server%",component(world));replaceToken(expanded,L"%character%",component(character));replaceToken(expanded,L"%date%",date);
    std::replace(expanded.begin(),expanded.end(),L'/',L'\\');
    if(expanded.starts_with(L"\\\\")||expanded.starts_with(L"\\?")||expanded.starts_with(L"\\."))throw std::invalid_argument("Choose a local log file, not a network or device path.");
    std::filesystem::path path(expanded);if(path.has_root_name()&&!path.is_absolute()||path.has_root_directory()&&!path.has_root_name())throw std::invalid_argument("Use a complete local path or a relative log filename.");
    for(const auto& part:path.relative_path()){
        const auto value=part.wstring();if(value.empty()||value==L"."||value==L".."||value.back()==L' '||value.back()==L'.')throw std::invalid_argument("Invalid log path component.");
        for(auto c:value)if(c<32||std::wstring_view(L":*?\"<>|").find(c)!=std::wstring_view::npos)throw std::invalid_argument("Invalid character in log filename.");
        const auto base=lower(value.substr(0,value.find(L'.')));
        if(base==L"con"||base==L"prn"||base==L"aux"||base==L"nul"||(base.size()==4&&(base.starts_with(L"com")||base.starts_with(L"lpt"))&&base[3]>=L'1'&&base[3]<=L'9'))throw std::invalid_argument("Device names cannot be used as log filenames.");
    }
    auto extension=lower(path.extension().wstring());if(extension.empty()){path+=L".txt";extension=L".txt";}
    if(extension!=L".txt"&&extension!=L".log"&&extension!=L".html"&&extension!=L".htm")throw std::invalid_argument("Log files must use .txt, .log, .html or .htm.");
    if(appendDate)path=path.parent_path()/(path.stem().wstring()+L" - "+date+path.extension().wstring());
    if(path.is_relative())path=logsRoot/path;
    return path.lexically_normal();
}
}
