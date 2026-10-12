#include "../native-encoding.h"
#include "../native-encoding-connect.h"
#include <iostream>
#include <stdexcept>
using namespace BeipEncoding;
void check(bool value,const char* label){if(!value)throw std::runtime_error(label);}
std::string literal(std::initializer_list<unsigned char> bytes){std::string out;for(auto byte:bytes)out+=static_cast<char>(byte);return out;}
int main(int argc,char** argv){
    if(argc==2&&std::string_view(argv[1])=="--tables"){
        std::cout<<'{';bool first=true;
        for(UINT page:{1252u,437u}){if(!first)std::cout<<',';first=false;std::cout<<'"'<<page<<"\":[";
            for(int byte=128;byte<256;++byte){char input=static_cast<char>(byte);wchar_t output{};check(MultiByteToWideChar(page,0,&input,1,&output,1)==1,"Windows table conversion");if(byte!=128)std::cout<<',';std::cout<<static_cast<unsigned>(output);}
            std::cout<<']';}
        std::cout<<"}\n";return 0;
    }
    SecureBytes result;Encoding encoding{};
    ConnectRequest connection;
    check(parseConnect("connect2|one|example.invalid|4000|plain||windows-1252|0",connection)&&connection.character.empty()&&connection.encoding==Encoding::Windows1252&&!connection.tls,"connect2 empty character and CP1252 binding");
    check(parseConnect("connect2|two|example.invalid|443|tls|character2|cp437|1",connection)&&connection.character=="character2"&&connection.tls&&connection.limit,"connect2 character TLS and restriction binding");
    for(const auto invalid:{"connect2|one|example.invalid|4000|plain||cp850|0","connect2|one|example.invalid|0|plain||utf-8|0","connect2|one|example.invalid|65536|plain||utf-8|0","connect2|one|bad/host|4000|plain||utf-8|0","connect2|one|example.invalid|4000|invalid||utf-8|0","connect2|one|example.invalid|4000|plain||utf-8|yes","connect2|one|example.invalid|4000|plain||utf-8|0|extra"})check(!parseConnect(invalid,connection),"invalid connect2 rejected before binding");
    check(parse("cp437",encoding)&&encoding==Encoding::Cp437&&!parse("cp850",encoding),"strict encoding names");
    check(encode("é€ÿ",Encoding::Windows1252,result)&&result.value==literal({0xe9,0x80,0xff}),"CP1252 exact outbound bytes");
    check(encode("é│█ ",Encoding::Cp437,result)&&result.value==literal({0x82,0xb3,0xdb,0xff}),"CP437 exact outbound bytes");
    check(commandWire("ÿ",Encoding::Windows1252,result)&&result.value==literal({0xff,0xff,13,10}),"CP1252 conversion before IAC escaping");
    check(commandWire(" ",Encoding::Cp437,result)&&result.value==literal({0xff,0xff,13,10}),"CP437 conversion before IAC escaping");
    check(commandWire("ÿ",Encoding::Utf8,result)&&result.value==literal({0xc3,0xbf,13,10}),"UTF8 remains byte identical");
    check(encode("dragon 🐉",Encoding::Windows1252,result)&&result.value.starts_with("dragon ")&&result.value.find('?')!=result.value.npos,"Windows default substitution");
    check(encode("Ā",Encoding::Windows1252,result)&&result.value=="A","original Windows best fit flags0");
    check(!commandWire("line\nnext",Encoding::Utf8,result)&&result.value.empty(),"no multiline command");
    check(!encode(literal({0xc3}),Encoding::Windows1252,result)&&result.value.empty(),"invalid source UTF8 rejected");
    check(encode("",Encoding::Cp437,result)&&result.value.empty(),"empty input");
    // Synthetic login exercises the same helper; no saved/private credentials.
    check(commandWire("connect José synthetic-é",Encoding::Cp437,result)&&result.value.find(literal({0x82}))!=result.value.npos,"native expanded login uses selected encoding");
    result.clear();check(result.value.empty(),"explicit secret buffer wipe");
    std::cout<<"Native encoding, best-fit, command framing and IAC tests passed.\n";
}
