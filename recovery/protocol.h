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
public:
    std::function<void(std::string_view)> output, reply;
    std::function<void(bool)> mxp;
    static std::string command(unsigned char verb, unsigned char option) {
        return std::string{static_cast<char>(static_cast<unsigned char>(255)),char(verb),char(option)};
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
                    bool supported=c==0 || c==1 || c==3 || c==25 || c==91;
                    bool changed=!remote[c];
                    if(!remote[c]) reply(command(supported?253:254,c));
                    remote[c]=supported;
                    if(c==91 && supported && changed) {flush();mxp(true);}
                } else if(verb==252) {
                    if(remote[c]) reply(command(254,c));
                    remote[c]=false;
                    if(c==91) {flush();mxp(false);}
                } else if(verb==253) {
                    bool supported=c==0 || c==3 || c==24 || c==31;
                    if(!local[c]) {
                        reply(command(supported?251:252,c));
                        if(c==31) reply(std::string{"\xff\xfa\x1f\x00\x64\x00\x28\xff\xf0",9});
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
