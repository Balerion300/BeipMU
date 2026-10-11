#include "../protocol.h"
#include <stdexcept>
#include <iostream>
void require(bool result){if(!result)throw std::runtime_error("Telnet test failed");}
int main(){
    std::string output,replies;int enables=0;TelnetStream p;
    p.output=[&](std::string_view s){output+=s;};p.reply=[&](std::string_view s){replies+=s;};p.mxp=[&](bool on){enables+=on?1:-1;};
    auto wire=std::string("hello")+TelnetStream::command(251,91)+"world"+std::string("\xff\xfa\x5b\xff\xf0",5)+"!";
    for(char c:wire)p.feed(std::string_view(&c,1));
    require(output=="helloworld!");require(replies==TelnetStream::command(253,91));require(enables==2);
    p.feed(std::string("\xff\xfb\x5b",3));require(replies==TelnetStream::command(253,91));
    p.feed(std::string("\xff\xfb\x56",3));require(replies.ends_with(TelnetStream::command(254,86)));
    p.feed(std::string("\xff\xfd\x18\xff\xfa\x18\x01\xff\xf0",9));require(replies.find("BeipMU-Recovery")!=std::string::npos);
    output.clear();p.feed(std::string("a\xff\xffz",4));require(output==std::string("a\xffz",3));
    require(escapeTelnet(std::string("a\xffz",3))==std::string("a\xff\xffz",4));
    p.feed(std::string("\xff\xfc\x5b",3));require(enables==2-1);
    std::cout<<"Telnet fragmentation, negotiation, TTYPE, unsupported-option, and IAC tests passed.\n";
}
