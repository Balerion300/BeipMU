#pragma once
#include "native-encoding.h"
#include <array>
namespace BeipEncoding {
inline std::string_view name(Encoding encoding){return encoding==Encoding::Windows1252?"windows-1252":encoding==Encoding::Cp437?"cp437":"utf-8";}
struct ConnectRequest {std::string session,host,port,character;bool tls=false,limit=false;Encoding encoding=Encoding::Utf8;};
inline bool connectionId(std::string_view value){if(value.empty()||value.size()>64)return false;for(unsigned char c:value)if(!((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_'||c=='-'))return false;return true;}
inline bool parseConnect(std::string_view message,ConnectRequest& result){
    if(!message.starts_with("connect2|"))return false;message.remove_prefix(9);
    std::array<std::string_view,7> field;
    for(size_t i=0;i<field.size();++i){const auto at=message.find('|');if(i+1==field.size()){if(at!=message.npos)return false;field[i]=message;}else{if(at==message.npos)return false;field[i]=message.substr(0,at);message.remove_prefix(at+1);}}
    if(!connectionId(field[0])||(!field[4].empty()&&!connectionId(field[4])))return false;
    if(field[1].empty()||field[1].size()>253)return false;for(unsigned char c:field[1])if(c<=32||c==127||c=='/'||c=='\\')return false;
    if(field[2].empty()||field[2].size()>5)return false;unsigned port=0;for(unsigned char c:field[2]){if(c<'0'||c>'9')return false;port=port*10+c-'0';}if(!port||port>65535)return false;
    if(field[3]!="plain"&&field[3]!="tls")return false;
    Encoding encoding;if(!parse(field[5],encoding)||(field[6]!="0"&&field[6]!="1"))return false;
    result={std::string(field[0]),std::string(field[1]),std::string(field[2]),std::string(field[4]),field[3]=="tls",field[6]=="1",encoding};return true;
}
}
