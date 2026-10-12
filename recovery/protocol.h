#pragma once
#include <array>
#include <functional>
#include <string>
#include <string_view>

// Independent replacement for the unavailable socket/protocol framework.
class TelnetStream {
    enum State { Text, Iac, Option, Sub, SubIac } state = Text;
    unsigned char verb = 0;
    std::string sub;
    std::array<bool,256> remote{}, local{};
    unsigned short columns=100, rows=40;
public:
    std::function<void(std::string_view)> output, reply, gmcp;
    std::function<void(bool)> mxp;
    std::function<void(bool)> gmcpAvailable;
    static std::string command(unsigned char verb, unsigned char option) {
        return std::string{static_cast<char>(static_cast<unsigned char>(255)),char(verb),char(option)};
    }
    static std::string subneg(unsigned char option,std::string_view payload) {
        std::string wire{"\xff\xfa",2};wire+=char(option);
        for(unsigned char c:payload){wire+=char(c);if(c==255)wire+=char(c);}
        wire+=std::string{"\xff\xf0",2};return wire;
    }
    static std::string naws(unsigned short width,unsigned short height){
        std::string size{char(width>>8),char(width&255),char(height>>8),char(height&255)};
        return subneg(31,size);
    }
    void resize(unsigned short width,unsigned short height){
        if(!width||!height||(columns==width&&rows==height))return;
        columns=width;rows=height;if(local[31]&&reply)reply(naws(columns,rows));
    }
    void feed(std::string_view bytes) {
        std::string clean;
        auto flush = [&] { if (!clean.empty()) { output(clean); clean.clear(); } };
        for (unsigned char c: bytes) {
            switch(state) {
            case Text:
                if(c==255) state=Iac; else if(c) clean+=char(c);
                break;
            case Iac:
                if(c==255) {clean+=char(c);state=Text;}
                else if(c>=251 && c<=254) {verb=c;state=Option;}
                else if(c==250) {sub.clear();state=Sub;}
                else state=Text;
                break;
            case Option: {
                state=Text;
                if(verb==251) { // WILL: accept only implemented options.
                    bool supported=c==0 || c==1 || c==3 || c==25 || c==91 || c==201;
                    bool changed=!remote[c];
                    if(!remote[c]) reply(command(supported?253:254,c));
                    remote[c]=supported;
                    if(c==91 && supported && changed) {flush();mxp(true);}
                    if(c==201 && supported && changed) {
                        flush();if(gmcpAvailable)gmcpAvailable(true);
                        reply(subneg(201,"Core.Hello {\"client\":\"BeipMU-Recovery\",\"version\":\"0.10\"}"));
                        reply(subneg(201,"Core.Supports.Set [\"Beip.Stats 1\",\"Beip.Tilemap 1\",\"Beip.Id 1\",\"Client.Media 1\"]"));
                    }
                } else if(verb==252) {
                    if(remote[c]) reply(command(254,c));
                    remote[c]=false;
                    if(c==91) {flush();mxp(false);}
                    if(c==201) {flush();if(gmcpAvailable)gmcpAvailable(false);}
                } else if(verb==253) {
                    bool supported=c==0 || c==3 || c==24 || c==31;
                    if(!local[c]) {
                        reply(command(supported?251:252,c));
                        if(c==31&&supported) reply(naws(columns,rows));
                    }
                    local[c]=supported;
                } else {if(local[c])reply(command(252,c));local[c]=false;}
                break;
            }
            case Sub:
                if(c==255)state=SubIac;
                else if(sub.size()<65536)sub+=char(c);
                break;
            case SubIac:
                if(c==240) {
                    if(sub.size()>=2 && (unsigned char)sub[0]==24 && sub[1]==1 && local[24])
                        reply(std::string("\xff\xfa\x18\x00",4)+"BeipMU-Recovery"+std::string("\xff\xf0",2));
                    if(!sub.empty() && (unsigned char)sub[0]==91 && remote[91]) {flush();mxp(true);}
                    if(!sub.empty() && (unsigned char)sub[0]==201 && remote[201] && gmcp) {flush();gmcp(std::string_view(sub).substr(1));}
                    state=Text;
                } else {if(c==255 && sub.size()<65536)sub+=char(c);state=Sub;}
                break;
            }
        }
        flush();
    }
};

inline std::string escapeTelnet(std::string_view input) {
    std::string out;
    for(unsigned char c:input) {out+=char(c);if(c==255)out+=char(c);}
    return out;
}
