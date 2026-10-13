#include "../protocol.h"
#include <stdexcept>
#include <iostream>
#include <vector>
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
    std::string gmcp;int available=0;std::vector<std::string> ordered;
    TelnetStream g;g.output=[&](std::string_view s){ordered.push_back("text:"+std::string(s));};
    g.reply=[&](std::string_view s){gmcp+=s;};
    g.gmcp=[&](std::string_view s){ordered.push_back("gmcp:"+std::string(s));};
    g.gmcpAvailable=[&](bool on){available+=on?1:-1;};
    g.feed(std::string("before\xff\xfb\xc9",9));
    require(available==1);require(ordered.size()==1&&ordered[0]=="text:before");
    require(gmcp.starts_with(TelnetStream::command(253,201)));
    require(gmcp.find(TelnetStream::subneg(201,"Core.Hello {\"client\":\"BeipMU-Recovery\",\"version\":\"0.3\"}"))!=std::string::npos);
    require(gmcp.find(TelnetStream::subneg(201,"Core.Supports.Set [\"Beip.Stats 1\",\"Beip.Tilemap 1\",\"Beip.Id 1\",\"Client.Media 1\"]"))!=std::string::npos);
    auto original=gmcp;g.feed(TelnetStream::command(251,201));require(gmcp==original);
    auto payload=std::string("Beip.Stats {\"hp\":\"\xff\"}");
    auto wireGmcp=TelnetStream::subneg(201,payload);require(wireGmcp.find("\xff\xff")!=std::string::npos);
    g.feed(std::string("x")+wireGmcp+"y");
    require(ordered.size()==4&&ordered[1]=="text:x"&&ordered[2]=="gmcp:"+payload&&ordered[3]=="text:y");
    g.feed(TelnetStream::command(252,201));require(available==0);
    auto beforeCount=ordered.size();g.feed(wireGmcp);require(ordered.size()==beforeCount);
    auto beforeReconnect=gmcp.size();
    g.feed(TelnetStream::command(251,201));require(available==1);
    require(gmcp.find("Core.Hello",beforeReconnect)!=std::string::npos);
    std::string windowSizes;TelnetStream dimensions;
    dimensions.reply=[&](std::string_view s){windowSizes+=s;};
    dimensions.output=[](std::string_view){};
    dimensions.resize(120,32);dimensions.feed(TelnetStream::command(253,31));
    auto expected=TelnetStream::command(251,31)+TelnetStream::naws(120,32);
    require(windowSizes==expected);
    dimensions.resize(255,40);expected+=TelnetStream::naws(255,40);
    require(windowSizes==expected&&windowSizes.find("\xff\xff")!=std::string::npos);
    dimensions.resize(255,40);require(windowSizes==expected);
    std::cout<<"Telnet fragmentation, negotiation, TTYPE, GMCP, NAWS, unsupported-option, and IAC tests passed.\n";
}
