#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <shellapi.h>
#include <commdlg.h>
#include <wincred.h>
#include <wrl.h>
#include <WebView2.h>
#include "tls.h"
#include "native-log-name.h"
#include <atomic>
#include <mutex>
#include <thread>
#include <string>
#include <vector>
#include <fstream>
#include <filesystem>
#include <memory>
#include <initializer_list>
#include <utility>
#include <unordered_map>
#include <chrono>
#include <cctype>
#include <cstdio>
#include <cstring>
#include "protocol.h"
#include "trigger-audio.h"

using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Callback;
static constexpr UINT NetworkMessage=WM_APP+1;
static constexpr UINT TriggerAudioMessage=WM_APP+3;
static constexpr size_t MaxNativeSessions=64;
static constexpr size_t ClipboardTextLimit=1024*1024;
enum MenuCommand : UINT {
    FileNew=1001,FileClose,FileExport,FileExit,
    EditCopy,EditSelectAll,EditFind,EditClear,
    ConnectionConnect,ConnectionDisconnect,ConnectionConnectAll,ConnectionDisconnectAll,ConnectionProfiles,
    LoggingToggle,
    OptionsAliases,OptionsTriggers,OptionsMacros,OptionsScripts,OptionsMap,OptionsPreferences,
    HelpAbout,EditFollowOutput,WindowHistory,WindowImage,WindowNotes,WindowSplit,WindowSpawn,EditSmartPaste,OptionsImport,OptionsShortcuts,WindowCopySettings,WindowPasteSettings,OptionsAtlasExport,OptionsScriptDebug
};
HMENU createMainPopup(){
    HMENU root=CreatePopupMenu();if(!root)return nullptr;
    auto section=[root](const wchar_t* title,std::initializer_list<std::pair<UINT,const wchar_t*>> items){
        HMENU popup=CreatePopupMenu();if(!popup)return;
        for(auto [id,label]:items)AppendMenuW(popup,id?MF_STRING:MF_SEPARATOR,id,label);
        if(!AppendMenuW(root,MF_POPUP,reinterpret_cast<UINT_PTR>(popup),title))DestroyMenu(popup);
    };
    section(L"&Windows",{{FileNew,L"New &Tab"},{WindowHistory,L"Toggle &History Window"},{WindowImage,L"Toggle &Image Window"},{OptionsMap,L"Toggle &Map Window"},{WindowNotes,L"Toggle Character &Notes"},{WindowSplit,L"Toggle &Split Output"},{WindowSpawn,L"Show &Spawn Windows"},{0,nullptr},{WindowCopySettings,L"Copy all window settings"},{WindowPasteSettings,L"Paste all window settings"},{0,nullptr},{FileClose,L"&Close Tab"}});
    HMENU tools=CreatePopupMenu();
    if(tools){
        AppendMenuW(tools,MF_STRING,OptionsTriggers,L"&Triggers...\tCtrl+Shift+T");
        AppendMenuW(tools,MF_STRING,OptionsMacros,L"&Macros...\tCtrl+Shift+M");
        AppendMenuW(tools,MF_STRING,OptionsAliases,L"&Aliases...\tCtrl+Shift+A");
        AppendMenuW(tools,MF_SEPARATOR,0,nullptr);
        AppendMenuW(tools,MF_STRING,EditFind,L"&Find...");
        AppendMenuW(tools,MF_STRING,FileExport,L"&Export Transcript...");
        AppendMenuW(tools,MF_STRING,OptionsScripts,L"&Scripts...");
        AppendMenuW(tools,MF_STRING,OptionsScriptDebug,L"Script Debug Output...");
        AppendMenuW(tools,MF_STRING,OptionsImport,L"Import Original Settings or Map...");
        AppendMenuW(tools,MF_STRING,OptionsAtlasExport,L"Export Atlas Map...");
        AppendMenuW(tools,MF_STRING,OptionsShortcuts,L"Keyboard Shortcuts...");
        HMENU edit=CreatePopupMenu();
        if(edit){
            AppendMenuW(edit,MF_STRING,EditCopy,L"&Copy");
            AppendMenuW(edit,MF_STRING,EditSelectAll,L"Select &All");
            AppendMenuW(edit,MF_STRING,EditSmartPaste,L"&Smart Paste...");
            AppendMenuW(edit,MF_STRING,EditClear,L"C&lear Output");
            AppendMenuW(edit,MF_STRING,EditFollowOutput,L"Follow &Output");
            if(!AppendMenuW(tools,MF_POPUP,reinterpret_cast<UINT_PTR>(edit),L"&Edit Output"))DestroyMenu(edit);
        }
        if(!AppendMenuW(root,MF_POPUP,reinterpret_cast<UINT_PTR>(tools),L"&Tools"))DestroyMenu(tools);
    }
    AppendMenuW(root,MF_STRING,LoggingToggle,L"&Logging...\tCtrl+L");
    AppendMenuW(root,MF_STRING,OptionsPreferences,L"&Settings...");
    section(L"&Help",{{HelpAbout,L"&About..."}});
    AppendMenuW(root,MF_SEPARATOR,0,nullptr);
    AppendMenuW(root,MF_STRING,FileExit,L"Close all Windows and E&xit");
    return root;
}
const char* menuAction(UINT command){
    switch(command){
        case FileNew:return "ui:file-new";case FileClose:return "ui:file-close";case FileExport:return "ui:file-export";
        case EditCopy:return "ui:edit-copy";case EditSelectAll:return "ui:edit-select-all";case EditFind:return "ui:edit-find";case EditClear:return "ui:edit-clear";
        case EditFollowOutput:return "ui:edit-follow-output";
        case EditSmartPaste:return "ui:edit-smart-paste";
        case WindowHistory:return "ui:window-input-history";case WindowImage:return "ui:window-image";
        case WindowNotes:return "ui:window-character-notes";case WindowSplit:return "ui:window-split";case WindowSpawn:return "ui:window-spawn";
        case WindowCopySettings:return "ui:window-copy-settings";case WindowPasteSettings:return "ui:window-paste-settings";
        case OptionsAtlasExport:return "ui:options-atlas-export";
        case OptionsScriptDebug:return "ui:options-script-debug";
        case ConnectionConnect:return "ui:connection-connect";case ConnectionDisconnect:return "ui:connection-disconnect";
        case ConnectionConnectAll:return "ui:connection-connect-all";case ConnectionDisconnectAll:return "ui:connection-disconnect-all";case ConnectionProfiles:return "ui:connection-profiles";
        case LoggingToggle:return "ui:logging-toggle";
        case OptionsAliases:return "ui:options-aliases";case OptionsTriggers:return "ui:options-triggers";case OptionsMacros:return "ui:options-macros";
        case OptionsImport:return "ui:options-import";case OptionsShortcuts:return "ui:options-shortcuts";
        case OptionsScripts:return "ui:options-scripts";case OptionsMap:return "ui:options-map";case OptionsPreferences:return "ui:options-preferences";
        case HelpAbout:return "ui:help-about";
        default:return nullptr;
    }
}
struct Event {std::string text;};
std::wstring wide(std::string_view s) {
    int n=MultiByteToWideChar(CP_UTF8,0,s.data(),int(s.size()),nullptr,0);
    std::wstring out(n,0);MultiByteToWideChar(CP_UTF8,0,s.data(),int(s.size()),out.data(),n);return out;
}
std::string utf8(std::wstring_view s) {
    int n=WideCharToMultiByte(CP_UTF8,0,s.data(),int(s.size()),nullptr,0,nullptr,nullptr);
    std::string out(n,0);WideCharToMultiByte(CP_UTF8,0,s.data(),int(s.size()),out.data(),n,nullptr,nullptr);return out;
}
std::string jsonString(std::string_view text){
    std::string out="\"";
    for(unsigned char c:text){
        if(c=='\"'||c=='\\'){out+='\\';out+=char(c);}
        else if(c<32){char escape[7];sprintf_s(escape,"\\u%04x",unsigned(c));out+=escape;}
        else out+=char(c);
    }
    return out+'\"';
}
void captureNativeWindowEvidence(HWND window,HMENU menu,const std::filesystem::path& testPath){
    int itemCount=menu?GetMenuItemCount(menu):-1;
    {
        std::ofstream file(testPath/L"menu.json",std::ios::binary|std::ios::trunc);
        std::vector<std::string> labels;
        for(int i=0;i<itemCount&&i<64;++i){
            MENUITEMINFOW info{};info.cbSize=sizeof(info);info.fMask=MIIM_FTYPE;
            if(GetMenuItemInfoW(menu,UINT(i),TRUE,&info)&&(info.fType&MFT_SEPARATOR))continue;
            wchar_t label[256]{};int length=GetMenuStringW(menu,UINT(i),label,256,MF_BYPOSITION);
            labels.push_back(utf8(std::wstring_view(label,size_t(length))));
        }
        file<<"{\"count\":"<<labels.size()<<",\"itemCount\":"<<itemCount<<",\"labels\":[";
        for(size_t i=0;i<labels.size();++i){if(i)file<<',';file<<jsonString(labels[i]);}
        file<<"]}\n";
    }
    auto failed=[&](const char* reason){std::ofstream(testPath/L"window-capture-error.txt",std::ios::binary|std::ios::trunc)<<reason<<'\n';};
    RECT rect{};
    if(!GetWindowRect(window,&rect)){failed("GetWindowRect failed.");return;}
    int width=rect.right-rect.left,height=rect.bottom-rect.top;
    if(width<1||height<1||width>4096||height>4096){failed("Window dimensions are outside the capture limit.");return;}
    HDC screen=GetDC(window);
    HDC memory=screen?CreateCompatibleDC(screen):nullptr;
    BITMAPINFO info{};info.bmiHeader.biSize=sizeof(BITMAPINFOHEADER);info.bmiHeader.biWidth=width;
    info.bmiHeader.biHeight=-height;info.bmiHeader.biPlanes=1;info.bmiHeader.biBitCount=32;info.bmiHeader.biCompression=BI_RGB;
    void* pixels=nullptr;
    HBITMAP bitmap=memory?CreateDIBSection(screen,&info,DIB_RGB_COLORS,&pixels,nullptr,0):nullptr;
    if(!bitmap||!pixels){if(bitmap)DeleteObject(bitmap);if(memory)DeleteDC(memory);if(screen)ReleaseDC(window,screen);failed("Could not create the window bitmap.");return;}
    HGDIOBJ previous=SelectObject(memory,bitmap);
    if(!previous||previous==HGDI_ERROR){DeleteObject(bitmap);DeleteDC(memory);ReleaseDC(window,screen);failed("Could not select the window bitmap.");return;}
    BOOL captured=PrintWindow(window,memory,2); // PW_RENDERFULLCONTENT
    if(captured){
        DWORD bytes=DWORD(width)*DWORD(height)*4;
        info.bmiHeader.biSizeImage=bytes;
        BITMAPFILEHEADER header{};header.bfType=0x4D42;header.bfOffBits=sizeof(header)+sizeof(BITMAPINFOHEADER);header.bfSize=header.bfOffBits+bytes;
        std::ofstream file(testPath/L"window.bmp",std::ios::binary|std::ios::trunc);
        file.write(reinterpret_cast<const char*>(&header),sizeof(header));
        file.write(reinterpret_cast<const char*>(&info.bmiHeader),sizeof(info.bmiHeader));
        file.write(reinterpret_cast<const char*>(pixels),bytes);
        if(!file)failed("Could not save the window bitmap.");
    }else failed("PrintWindow failed.");
    SelectObject(memory,previous);DeleteObject(bitmap);DeleteDC(memory);ReleaseDC(window,screen);
}
std::string base64(std::string_view s) {
    static const char alphabet[]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;unsigned value=0;int bits=-6;
    for(unsigned char c:s){value=(value<<8)|c;bits+=8;while(bits>=0){out+=alphabet[(value>>bits)&63];bits-=6;}}
    if(bits>-6)out+=alphabet[((value<<8)>>(bits+8))&63];while(out.size()%4)out+='=';return out;
}
bool unbase64(std::string_view s,std::string& out,size_t limit=65536) {
    if(s.size()%4 || s.size()>((limit+2)/3)*4)return false;
    out.clear();out.reserve(s.size()/4*3);
    unsigned value=0;int bits=0;unsigned padding=0;
    for(size_t i=0;i<s.size();++i){
        unsigned char c=s[i];if(c=='='){++padding;if(i<s.size()-2||padding>2)return false;continue;}
        if(padding)return false;
        int digit=(c>='A'&&c<='Z')?c-'A':(c>='a'&&c<='z')?c-'a'+26:(c>='0'&&c<='9')?c-'0'+52:c=='+'?62:c=='/'?63:-1;
        if(digit<0)return false;value=(value<<6)|unsigned(digit);bits+=6;
        if(bits>=8){bits-=8;out+=char((value>>bits)&255);}
    }
    return out.size()<=limit && ((padding==0&&bits==0)||(padding==1&&bits==2)||(padding==2&&bits==4)) && (value&((1u<<bits)-1))==0;
}
bool validUtf8(std::string_view s){return s.empty()||MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,s.data(),int(s.size()),nullptr,0)>0;}
bool writeClipboardText(HWND window,std::string_view encoded){
    std::string decoded;
    if(!unbase64(encoded,decoded,ClipboardTextLimit)||decoded.empty()||!validUtf8(decoded)||decoded.find('\0')!=decoded.npos)return false;
    std::wstring value=wide(decoded);
    if(value.empty())return false;
    size_t bytes=(value.size()+1)*sizeof(wchar_t);
    HGLOBAL block=GlobalAlloc(GMEM_MOVEABLE,bytes);
    if(!block)return false;
    void* memory=GlobalLock(block);
    if(!memory){GlobalFree(block);return false;}
    std::memcpy(memory,value.c_str(),bytes);
    GlobalUnlock(block);
    if(!OpenClipboard(window)){GlobalFree(block);return false;}
    bool saved=EmptyClipboard()!=FALSE && SetClipboardData(CF_UNICODETEXT,block)!=nullptr;
    if(saved)block=nullptr; // The clipboard now owns the allocation.
    CloseClipboard();
    if(block)GlobalFree(block);
    return saved;
}
bool validLoginField(std::string_view s,size_t limit){
    if(s.empty()||s.size()>limit||!validUtf8(s))return false;
    for(unsigned char c:s)if(c<32||c==127)return false;
    return true;
}
bool readClipboardText(HWND window,std::string& result){
 if(!OpenClipboard(window))return false;HANDLE block=GetClipboardData(CF_UNICODETEXT);bool ok=false;
 if(block){const size_t bytes=GlobalSize(block);if(bytes>0&&bytes<=(ClipboardTextLimit+1)*sizeof(wchar_t)){const auto value=static_cast<const wchar_t*>(GlobalLock(block));if(value){size_t length=0,capacity=bytes/sizeof(wchar_t);while(length<capacity&&value[length])++length;if(length<capacity){result=utf8(std::wstring(value,length));ok=result.size()<=ClipboardTextLimit;}GlobalUnlock(block);}}}
 CloseClipboard();return ok;
}
bool validId(std::string_view id) {
    if(id.empty()||id.size()>64)return false;
    for(unsigned char c:id)if(!((c>='A'&&c<='Z')||(c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_'||c=='-'))return false;
    return true;
}
bool validHost(std::string_view host){
    if(host.empty()||host.size()>253)return false;
    for(unsigned char c:host)if(c<=32||c==127||c=='|'||c=='/'||c=='\\')return false;
    return true;
}
class Client {
    HWND window=nullptr;std::string id,boundCharacter;bool legacy=false,secure=false,tlsReady=false;
    SOCKET socket=INVALID_SOCKET;std::mutex lock;BeipTLS::Stream tls;
    std::thread worker;std::atomic<bool> stop{false},gmcpReady{false},resizePending{false};
    std::atomic<unsigned short> columns{100},rows{40};
    std::mutex logLock;std::ofstream logFile;std::filesystem::path logPath;
    void post(std::string s){auto event=new Event{legacy?std::move(s):"session:"+id+":"+s};if(!PostMessageW(window,NetworkMessage,0,(LPARAM)event))delete event;}
    bool transmit(std::string_view s){
        std::lock_guard guard(lock);if(socket==INVALID_SOCKET||(secure&&!tlsReady))return false;
        while(!s.empty()){int n=secure?tls.send(s):send(socket,s.data(),int(s.size()),0);if(n<=0)return false;s.remove_prefix(n);}return true;
    }
public:
    Client(HWND w,std::string session,bool old=false):window(w),id(std::move(session)),legacy(old){}
    Client(const Client&)=delete;Client& operator=(const Client&)=delete;
    void disconnect(){stop=true;gmcpReady=false;{std::lock_guard guard(lock);tlsReady=false;if(socket!=INVALID_SOCKET)shutdown(socket,SD_BOTH);}if(worker.joinable())worker.join();{std::lock_guard guard(lock);if(socket!=INVALID_SOCKET){closesocket(socket);socket=INVALID_SOCKET;}tls.reset();}}
    ~Client(){disconnect();}
    void logStart(const std::filesystem::path& root,const std::filesystem::path& selected={}){
        std::lock_guard guard(logLock);
        if(logFile.is_open()){post("logstatus:on:"+base64(utf8(logPath.wstring())));return;}
        if(!selected.empty()){
            std::error_code error;std::filesystem::create_directories(selected.parent_path(),error);
            if(error){post("logstatus:error:"+base64("Could not create the log folder."));return;}
            bool empty=!std::filesystem::exists(selected,error)||std::filesystem::file_size(selected,error)==0;
            logFile.clear();logFile.open(selected,std::ios::binary|std::ios::app);
            if(!logFile){post("logstatus:error:"+base64("Could not open the selected log file."));return;}
            logPath=selected;auto extension=BeipLogName::lower(selected.extension().wstring());
            if(empty&&(extension==L".html"||extension==L".htm"))logFile<<"<!doctype html>\r\n<meta charset=\"utf-8\"><title>BeipMU log</title>\r\n<body style=\"font-family:monospace\">\r\n";
            logFile.flush();post("logstatus:on:"+base64(utf8(logPath.wstring())));return;
        }
        std::error_code ec;auto dir=root/L"Logs";std::filesystem::create_directories(dir,ec);
        if(ec){post("logstatus:error:"+base64("Could not create the Logs folder."));return;}
        SYSTEMTIME now;GetLocalTime(&now);wchar_t stamp[32];swprintf_s(stamp,L"%04u%02u%02u-%02u%02u%02u",now.wYear,now.wMonth,now.wDay,now.wHour,now.wMinute,now.wSecond);
        for(unsigned attempt=0;attempt<100;++attempt){
            auto candidate=dir/(std::wstring(stamp)+L"-"+wide(id)+L"-"+std::to_wstring(GetTickCount64())+L"-"+std::to_wstring(attempt)+L".log");
            HANDLE fresh=CreateFileW(candidate.c_str(),GENERIC_WRITE,FILE_SHARE_READ,nullptr,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,nullptr);
            if(fresh==INVALID_HANDLE_VALUE)continue;CloseHandle(fresh);
            logFile.open(candidate,std::ios::binary|std::ios::app);if(logFile){logPath=candidate;post("logstatus:on:"+base64(utf8(logPath.wstring())));return;}
            std::filesystem::remove(candidate,ec);
        }
        post("logstatus:error:"+base64("Could not open a log file."));
    }
    void logStop(){std::lock_guard guard(logLock);if(logFile.is_open())logFile.close();logPath.clear();post("logstatus:off");}
    void logWrite(std::string_view encoded){
        std::string record;if(!unbase64(encoded,record,262144)||!validUtf8(record)||record.find('\0')!=record.npos){post("logstatus:error:"+base64("Invalid log record."));return;}
        std::lock_guard guard(logLock);if(!logFile.is_open()){post("logstatus:error:"+base64("Logging is not active."));return;}
        logFile.write(record.data(),std::streamsize(record.size()));logFile.flush();if(!logFile)post("logstatus:error:"+base64("Could not write the log file."));
    }
    void logLine(std::string_view encoded){
        std::string line;if(!unbase64(encoded,line)||!validUtf8(line)||line.find('\r')!=line.npos||line.find('\n')!=line.npos){post("logstatus:error:"+base64("Invalid log line."));return;}
        std::lock_guard guard(logLock);if(!logFile.is_open()){post("logstatus:error:"+base64("Logging is not active."));return;}
        logFile.write(line.data(),std::streamsize(line.size()));logFile.put('\n');logFile.flush();
        if(!logFile)post("logstatus:error:"+base64("Could not write the log file."));
    }
    void command(std::string s){if(s.size()>8192||s.find('\n')!=s.npos||s.find('\r')!=s.npos){post("status:Command rejected: one line at a time, up to 8192 bytes.");return;}s+="\r\n";if(!transmit(escapeTelnet(s)))post("status:Not connected.");}
    void login(std::string_view username,std::string_view password){
        std::string line;line.reserve(11+username.size()+password.size());
        line="connect ";line.append(username);line+=' ';line.append(password);line+="\r\n";
        std::string wire=escapeTelnet(line);bool sent=transmit(wire);
        SecureZeroMemory(line.data(),line.size());SecureZeroMemory(wire.data(),wire.size());
        if(!sent)post("status:Could not send login command; connection is unavailable.");
    }
    void loginTemplate(std::string_view text,std::string_view username,std::string_view password){
        std::string line;for(size_t at=0;at<text.size();){if(text.substr(at,6)=="%NAME%"){line.append(username);at+=6;}else if(text.substr(at,10)=="%PASSWORD%"){line.append(password);at+=10;}else line+=text[at++];if(line.size()>8192){SecureZeroMemory(line.data(),line.size());post("status:Expanded connect template is too long.");return;}}
        line+="\r\n";std::string wire=escapeTelnet(line);bool sent=transmit(wire);SecureZeroMemory(line.data(),line.size());SecureZeroMemory(wire.data(),wire.size());if(!sent)post("status:Could not send connect template; connection is unavailable.");
    }
    void gmcpSend(std::string_view encoded){
        std::string payload;if(!unbase64(encoded,payload)||payload.size()>65535){post("status:Invalid GMCP payload.");return;}
        if(!gmcpReady){post("status:GMCP is not enabled for this connection.");return;}
        if(!transmit(TelnetStream::subneg(201,payload)))post("status:Could not send GMCP payload.");
        else post("gmcpsent:"+base64(payload));
    }
    void telnetNop(){if(!transmit(std::string_view("\xff\xf1",2)))post("status:Not connected.");}
    void resize(unsigned short width,unsigned short height){columns=width;rows=height;resizePending=true;}
    bool mayLogin(std::string_view character,bool allowPlain){std::lock_guard guard(lock);return !boundCharacter.empty()&&boundCharacter==character&&(secure||allowPlain);}
    void connect(std::string host,std::string port,bool useTls=false,std::string character={}){
        disconnect();{std::lock_guard guard(lock);secure=useTls;tlsReady=false;boundCharacter=std::move(character);}stop=false;
        worker=std::thread([this,host=std::move(host),port=std::move(port),useTls]{
            post("reset:");post("status:Connecting to "+host+":"+port+"...");
            addrinfo hints{},*addresses=nullptr;hints.ai_socktype=SOCK_STREAM;hints.ai_family=AF_UNSPEC;
            if(getaddrinfo(host.c_str(),port.c_str(),&hints,&addresses)){post("status:Could not resolve the server address.");post("connected:off");post("ended:");return;}
            SOCKET connected=INVALID_SOCKET;
            for(auto a=addresses;a&&!stop;a=a->ai_next){
                SOCKET candidate=WSASocketW(a->ai_family,a->ai_socktype,a->ai_protocol,nullptr,0,WSA_FLAG_OVERLAPPED);
                if(candidate==INVALID_SOCKET)continue;u_long nonblocking=1;ioctlsocket(candidate,FIONBIO,&nonblocking);
                int result=::connect(candidate,a->ai_addr,int(a->ai_addrlen));
                if(result==SOCKET_ERROR&&WSAGetLastError()==WSAEWOULDBLOCK){
                    for(int tick=0;tick<80&&!stop;tick++){fd_set ready,failed;FD_ZERO(&ready);FD_ZERO(&failed);FD_SET(candidate,&ready);FD_SET(candidate,&failed);timeval timeout{0,100000};
                        int count=select(0,nullptr,&ready,&failed,&timeout);if(count>0){int error=0,len=sizeof(error);getsockopt(candidate,SOL_SOCKET,SO_ERROR,(char*)&error,&len);result=error?SOCKET_ERROR:0;break;}}
                }
                if(result==0&&!stop){nonblocking=0;ioctlsocket(candidate,FIONBIO,&nonblocking);DWORD timeout=250;setsockopt(candidate,SOL_SOCKET,SO_RCVTIMEO,(char*)&timeout,sizeof(timeout));timeout=2000;setsockopt(candidate,SOL_SOCKET,SO_SNDTIMEO,(char*)&timeout,sizeof(timeout));connected=candidate;break;}
                closesocket(candidate);
            }
            freeaddrinfo(addresses);
            if(connected==INVALID_SOCKET){post("status:Connection failed.");post("connected:off");post("ended:");return;}
            {std::lock_guard guard(lock);socket=connected;}
            if(useTls){
                post("status:Securing connection to "+host+":"+port+"...");
                std::string error;
                if(!tls.handshake(connected,wide(host),error)||stop){
                    {std::lock_guard guard(lock);tlsReady=false;if(socket==connected){closesocket(socket);socket=INVALID_SOCKET;}tls.reset();}
                    if(!stop)post("status:TLS connection failed: "+error);
                    post("connected:off");post("ended:");return;
                }
                {std::lock_guard guard(lock);tlsReady=true;}
            }
            post("status:Connected to "+host+":"+port+(useTls?" (TLS).":" (plain TCP)."));
            post("connected:on");
            TelnetStream telnet;
            telnet.output=[this](std::string_view s){post("data:"+base64(s));};
            telnet.reply=[this](std::string_view s){transmit(s);};
            telnet.mxp=[this](bool enabled){post(enabled?"mxp:on":"mxp:off");};
            telnet.gmcp=[this](std::string_view s){post("gmcp:"+base64(s));};
            telnet.gmcpAvailable=[this](bool enabled){gmcpReady=enabled;post(enabled?"gmcpavailable:on":"gmcpavailable:off");};
            telnet.resize(columns.load(),rows.load());
            char buffer[16384];
            while(!stop){
                if(resizePending.exchange(false))telnet.resize(columns.load(),rows.load());
                int n=useTls?tls.recv(buffer,sizeof(buffer)):recv(connected,buffer,sizeof(buffer),0);
                if(n==0)break;if(n<0){int error=WSAGetLastError();if(error==WSAETIMEDOUT||error==WSAEWOULDBLOCK)continue;break;}
                telnet.feed(std::string_view(buffer,n));
            }
            {std::lock_guard guard(lock);tlsReady=false;if(socket==connected){closesocket(socket);socket=INVALID_SOCKET;}tls.reset();}
            gmcpReady=false;
            post("connected:off");post("ended:");post("status:Disconnected.");
        });
    }
};
#include "floating-window.h"
struct Application {
    std::unordered_map<std::string,std::shared_ptr<FloatingWindow>> floats;
    std::shared_ptr<bool> alive=std::make_shared<bool>(true);
    std::filesystem::path uiRoot;
    int floatCreated=0,floatReady=0,floatClosed=0;bool floatCaptured=false;std::string captureFloatId;
    void captureFloating(){
        KillTimer(window,2);auto it=floats.find(captureFloatId);ComPtr<IStream> stream;
        if(it==floats.end()||!it->second->view)return;
        if(FAILED(SHCreateStreamOnFileEx((testPath/L"floating-preview.png").c_str(),STGM_CREATE|STGM_WRITE|STGM_SHARE_EXCLUSIVE,0,TRUE,nullptr,&stream)))return;
        auto id=captureFloatId;it->second->view->CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,stream.Get(),Callback<ICoreWebView2CapturePreviewCompletedHandler>([this,live=alive,stream,id](HRESULT hr){
            if(*live){std::ofstream(testPath/"floating-capture-status.txt")<<hr;if(SUCCEEDED(hr)){floatCaptured=true;message("float:captured|"+id);}else message("float:capture-failed|"+id);}return S_OK;
        }).Get());
    }
    void floating(const std::string& text){
        std::vector<std::string> a;size_t start=0;for(size_t n;(n=text.find('|',start))!=text.npos;start=n+1)a.push_back(text.substr(start,n-start));a.push_back(text.substr(start));
        if(a.size()<2||!validId(a[1]))return;
        auto id=a[1];
        if(a[0]=="float:close"){if(auto it=floats.find(id);it!=floats.end()&&it->second->hwnd)PostMessageW(it->second->hwnd,WM_CLOSE,0,0);return;}
        std::string decoded;
        if(a[0]=="float:update"&&a.size()==3){if(unbase64(a[2],decoded,256*1024)&&validUtf8(decoded)){auto it=floats.find(id);if(it!=floats.end())it->second->update(a[2]);}return;}
        auto reject=[&]{message("float:error|"+id);};
        if(a[0]!="float:open"||a.size()!=9||!environment||!validId(a[2])){reject();return;}
        for(auto it=floats.begin();it!=floats.end();)if(!it->second->hwnd)it=floats.erase(it);else ++it;
        if(floats.contains(id)){reject();return;}
        std::string title;if(floats.size()>=12||!unbase64(a[3],title,160)||!validUtf8(title)||!unbase64(a[8],decoded,256*1024)||!validUtf8(decoded)){reject();return;}
        int geometry[4];try{for(int i=0;i<4;i++){size_t used=0;geometry[i]=std::stoi(a[4+i],&used);if(used!=a[4+i].size())throw 1;}}catch(...){reject();return;}
        geometry[2]=std::clamp(geometry[2],240,1400);geometry[3]=std::clamp(geometry[3],180,1000);
        auto f=std::make_shared<FloatingWindow>();f->id=id;f->snapshot=a[8];if(controller)controller->get_ZoomFactor(&f->ownerZoom);f->notify=[this,live=alive](const std::string& event){if(!*live)return;
            if(event.starts_with("float:ready|"))++floatReady;
            if(event.starts_with("float:closed|"))++floatClosed;
            if(testMode&&!floatCaptured&&event.starts_with("float:event|")){
                auto at=event.find('|',12);std::string json;
                if(at!=event.npos&&unbase64(event.substr(at+1),json)&&json.find("\"action\":\"rendered\"")!=json.npos){
                    captureFloatId=event.substr(12,at-12);SetTimer(window,2,150,nullptr);
                }
            }
            message(event);
        };f->zoomFactor=[this,live=alive]{double zoom=1;if(*live&&controller)controller->get_ZoomFactor(&zoom);return zoom;};floats[id]=f;
        if(!f->open(window,environment.Get(),uiRoot,title,geometry[0],geometry[1],geometry[2],geometry[3])){floats.erase(id);reject();}else ++floatCreated;
    }
    HWND window=nullptr;HMENU mainMenu=nullptr;std::unique_ptr<Client> legacyClient;std::unordered_map<std::string,std::unique_ptr<Client>> sessions;
    TriggerAudio triggerAudio;
    ComPtr<ICoreWebView2Environment> environment;ComPtr<ICoreWebView2Controller> controller;ComPtr<ICoreWebView2> view;
    std::filesystem::path testPath;int testPort=0;std::vector<int> testCorePorts;bool testMode=false,testTls=false,inspectMode=false,ready=false;std::vector<std::string> queued;
    std::unordered_map<std::string,std::string> testSecrets;
    std::filesystem::path dataRoot(){
        if(testMode)return testPath;
        PWSTR local=nullptr;SHGetKnownFolderPath(FOLDERID_LocalAppData,0,nullptr,&local);
        auto root=std::filesystem::path(local?local:L".")/L"BeipMU-Recovery";CoTaskMemFree(local);return root;
    }
    void trace(std::string_view direction,std::string_view value){
        if(!testMode)return;std::filesystem::create_directories(testPath);
        if(value.starts_with("secret:")||value.starts_with("login|")||value.starts_with("logintemplate|")||value.starts_with("clipboard:")||value.starts_with("export|"))return;
        // Only message names belong in the diagnostic trace; commands and server text may contain secrets.
        auto end=value.find_first_of(":|");auto kind=value.substr(0,end);
        std::ofstream(testPath/"trace.txt",std::ios::app)<<direction<<" "<<kind<<"\n";
    }
    void message(const std::string& text){trace("HOST",text);if(view&&ready)view->PostWebMessageAsString(wide(text).c_str());else if(queued.size()<256)queued.push_back(text);}
    void openMainMenu(){
        if(!mainMenu)return;
        RECT rect{};if(!GetClientRect(window,&rect))return;
        POINT at{rect.left+8,rect.bottom-6};ClientToScreen(window,&at);
        SetForegroundWindow(window);
        UINT command=TrackPopupMenu(mainMenu,TPM_LEFTALIGN|TPM_BOTTOMALIGN|TPM_RETURNCMD|TPM_NONOTIFY,at.x,at.y,0,window,nullptr);
        PostMessageW(window,WM_NULL,0,0); // Allows the popup to dismiss on the next outside click.
        if(command)SendMessageW(window,WM_COMMAND,MAKEWPARAM(command,0),0);
    }
    void scoped(const std::string& id,std::string payload){message("session:"+id+":"+payload);}
    void initializeTriggerAudio(){
        triggerAudio.initialize(window,TriggerAudioMessage,[this](const std::string& id,const std::string& action,const std::string& status,ULONG stream,const std::wstring& path){
            auto data="{\"action\":"+jsonString(action)+",\"status\":"+jsonString(status)+",\"stream\":"+std::to_string(stream);
            if(!path.empty())data+=",\"path\":"+jsonString(utf8(path));data+="}";
            scoped(id,"triggeraudio:"+data);
            if(testMode&&action!="browse"){std::filesystem::create_directories(testPath);std::ofstream(testPath/"trigger-audio.jsonl",std::ios::app)<<"{\"sessionId\":"<<jsonString(id)<<",\"event\":"<<data<<"}\n";}
        });
    }
    void receiveTriggerAudio(std::string_view text){
        auto first=text.find('|',13),second=first==text.npos?text.npos:text.find('|',first+1);
        if(second==text.npos)return;
        std::string id(text.substr(13,first-13));auto action=text.substr(first+1,second-first-1);
        // Main-page bridge only; a stale/closed session never gets an audio resource.
        if(!validId(id)||sessions.find(id)==sessions.end())return;
        std::string value;
        if(!unbase64(text.substr(second+1),value,8192)||!validUtf8(value))return;
        if(action=="stop"&&value.empty())triggerAudio.stop(id);
        else if(action=="browse"&&value.empty())triggerAudio.browse(id);
        else if(action=="sound")triggerAudio.sound(id,wide(value));
        else if(action=="speech")triggerAudio.speech(id,wide(value));
    }
    std::wstring secretTarget(std::string_view id){return L"BeipMU-Recovery/character/"+wide(id);}
    void secretReply(const std::string& id,std::string_view result){message("secretstatus:"+id+":"+std::string(result));}
    void secretError(const std::string& id,std::string_view error){secretReply(id,"error:"+base64(error));}
    bool readSecret(const std::string& id,std::string& password){
        if(testMode){auto it=testSecrets.find(id);if(it==testSecrets.end())return false;password=it->second;return true;}
        auto target=secretTarget(id);PCREDENTIALW record=nullptr;
        if(!CredReadW(target.c_str(),CRED_TYPE_GENERIC,0,&record))return false;
        bool okay=record&&record->CredentialBlob&&record->CredentialBlobSize>0&&record->CredentialBlobSize<=2048;
        if(okay)password.assign(reinterpret_cast<const char*>(record->CredentialBlob),record->CredentialBlobSize);
        if(record){if(record->CredentialBlob)SecureZeroMemory(record->CredentialBlob,record->CredentialBlobSize);CredFree(record);}
        return okay;
    }
    void saveSecret(const std::string& id,std::string_view encoded){
        if(!validId(id))return;
        std::string password;
        if(!unbase64(encoded,password)||!validLoginField(password,2048)){
            SecureZeroMemory(password.data(),password.size());
            secretError(id,"Invalid password; use one UTF-8 line up to 2048 bytes.");return;
        }
        bool saved=false;
        if(testMode){auto& slot=testSecrets[id];SecureZeroMemory(slot.data(),slot.size());slot=password;saved=true;}
        else {
            auto target=secretTarget(id);CREDENTIALW record{};record.Type=CRED_TYPE_GENERIC;record.TargetName=target.data();
            record.CredentialBlobSize=DWORD(password.size());record.CredentialBlob=reinterpret_cast<LPBYTE>(password.data());
            record.Persist=CRED_PERSIST_LOCAL_MACHINE;
            saved=CredWriteW(&record,0)!=FALSE;
        }
        SecureZeroMemory(password.data(),password.size());
        if(saved)secretReply(id,"on");else secretError(id,"Could not save password in Windows Credential Manager.");
    }
    void deleteSecret(const std::string& id){
        if(!validId(id))return;
        bool removed=false;
        if(testMode){auto it=testSecrets.find(id);if(it!=testSecrets.end()){SecureZeroMemory(it->second.data(),it->second.size());testSecrets.erase(it);}removed=true;}
        else {auto target=secretTarget(id);removed=CredDeleteW(target.c_str(),CRED_TYPE_GENERIC,0)!=FALSE||GetLastError()==ERROR_NOT_FOUND;}
        if(removed)secretReply(id,"off");else secretError(id,"Could not remove saved password.");
    }
    void secretStatus(const std::string& id){
        if(!validId(id))return;
        if(testMode){secretReply(id,testSecrets.contains(id)?"on":"off");return;}
        auto target=secretTarget(id);PCREDENTIALW record=nullptr;
        if(CredReadW(target.c_str(),CRED_TYPE_GENERIC,0,&record)){
            if(record){if(record->CredentialBlob)SecureZeroMemory(record->CredentialBlob,record->CredentialBlobSize);CredFree(record);}
            secretReply(id,"on");
        }else if(GetLastError()==ERROR_NOT_FOUND)secretReply(id,"off");
        else secretError(id,"Could not inspect Windows Credential Manager.");
    }
    void loginWithSecret(const std::string& session,const std::string& character,std::string_view encodedName,bool allowPlain){
        if(!validId(session)||!validId(character))return;
        auto it=sessions.find(session);if(it==sessions.end()){scoped(session,"status:Session is closed.");return;}
        if(!it->second->mayLogin(character,allowPlain)){
            scoped(session,"status:Saved login requires the selected character and explicit consent on plain TCP.");return;
        }
        std::string username,password;
        if(!unbase64(encodedName,username)||!validLoginField(username,128)){
            scoped(session,"status:Invalid login name.");return;
        }
        if(!readSecret(character,password)){scoped(session,"status:No saved password for this character.");return;}
        bool safe=validLoginField(password,2048);
        if(safe)it->second->login(username,password);else scoped(session,"status:Saved password is invalid.");
        SecureZeroMemory(password.data(),password.size());
    }
    void emojiCommand(std::string_view command){
        auto path=dataRoot()/L"Emoji.txt",original=uiRoot/L"Emoji.txt";std::error_code error;
        auto fail=[this](std::string_view reason){message("emoji:error:"+base64(reason));};
        if(command=="revert"){
            std::filesystem::remove(path,error);if(error){fail("Could not revert the custom Emoji.txt.");return;}
        }else if(command=="copy"||command=="edit"){
            std::filesystem::create_directories(path.parent_path(),error);if(error){fail("Could not create the emoji folder.");return;}
            if(!std::filesystem::exists(path,error)&&!std::filesystem::copy_file(original,path,std::filesystem::copy_options::none,error)){fail("Could not copy the default Emoji.txt.");return;}
            if(command=="edit"&&!testMode){auto argument=L"\""+path.wstring()+L"\"";if(reinterpret_cast<INT_PTR>(ShellExecuteW(window,L"open",L"notepad.exe",argument.c_str(),nullptr,SW_SHOWNORMAL))<=32){fail("Could not open Emoji.txt in Notepad.");return;}}
        }else if(command.starts_with("save|")){
            std::string source;if(!unbase64(command.substr(5),source,131072)||!validUtf8(source)||source.find('\0')!=source.npos){fail("Emoji.txt must be UTF-8 text of at most 128 KiB.");return;}
            std::filesystem::create_directories(path.parent_path(),error);if(error){fail("Could not create the emoji folder.");return;}
            auto temp=path.parent_path()/(L"emoji-"+std::to_wstring(GetCurrentProcessId())+L"-"+std::to_wstring(GetTickCount64())+L".tmp");
            {std::ofstream file(temp,std::ios::binary|std::ios::trunc);file.write(source.data(),std::streamsize(source.size()));file.flush();if(!file){file.close();std::filesystem::remove(temp,error);fail("Could not save Emoji.txt.");return;}}
            if(!MoveFileExW(temp.c_str(),path.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)){std::filesystem::remove(temp,error);fail("Could not replace Emoji.txt.");return;}
        }else if(command!="load"){return;}
        bool custom=std::filesystem::exists(path,error);if(!custom)path=original;
        auto size=std::filesystem::file_size(path,error);if(error||size>131072){fail("Emoji.txt is inaccessible or exceeds 128 KiB.");return;}
        std::ifstream file(path,std::ios::binary);std::string source((std::istreambuf_iterator<char>(file)),{});
        if(!file||file.bad()||!validUtf8(source)||source.find('\0')!=source.npos){fail("Could not read a valid UTF-8 Emoji.txt.");return;}
        message(std::string("emoji:source:")+(custom?"custom":"default")+"|"+base64(source));
    }
    void loadSettings(){
        auto path=dataRoot()/L"settings.json";std::error_code ec;
        if(!std::filesystem::exists(path,ec)){message("settings:"+base64("{}"));return;}
        auto size=std::filesystem::file_size(path,ec);
        if(ec||size>1024*1024){message("settings:error:Settings file is too large or inaccessible.");return;}
        std::ifstream file(path,std::ios::binary);
        if(!file){message("settings:error:Could not read settings.");return;}
        std::string content((std::istreambuf_iterator<char>(file)),{});
        if(!file.bad())message("settings:"+base64(content));else message("settings:error:Could not read settings.");
    }
    void saveSettings(std::string_view json){
        if(json.empty()||json.size()>1024*1024||json.front()!='{'||json.back()!='}'){
            message("settings:error:Invalid settings size or format.");return;
        }
        auto root=dataRoot();std::error_code ec;std::filesystem::create_directories(root,ec);
        if(ec){message("settings:error:Could not create the settings folder.");return;}
        auto path=root/L"settings.json";auto temp=root/(L"settings-"+std::to_wstring(GetCurrentProcessId())+L"-"+std::to_wstring(GetTickCount64())+L".tmp");
        {std::ofstream file(temp,std::ios::binary|std::ios::trunc);file.write(json.data(),std::streamsize(json.size()));file.flush();if(!file){file.close();std::filesystem::remove(temp,ec);message("settings:error:Could not write settings.");return;}}
        if(!MoveFileExW(temp.c_str(),path.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)){
            std::filesystem::remove(temp,ec);message("settings:error:Could not replace settings.");return;
        }
        message("settings:saved");
    }
    void exportTranscript(const std::string& id,std::string_view encoded){
        if(!validId(id)||sessions.find(id)==sessions.end())return;
        std::string transcript;
        if(!unbase64(encoded,transcript,4*1024*1024)||!validUtf8(transcript)){
            scoped(id,"exportstatus:error:"+base64("Transcript must be valid UTF-8 and at most 4 MiB."));return;
        }
        wchar_t filename[MAX_PATH]{};auto suggested=wide(id)+L"-transcript.txt";
        wcsncpy_s(filename,suggested.c_str(),_TRUNCATE);
        static const wchar_t filter[]=L"Text files (*.txt)\0*.txt\0All files (*.*)\0*.*\0\0";
        OPENFILENAMEW dialog{};dialog.lStructSize=sizeof(dialog);dialog.hwndOwner=window;
        dialog.lpstrFile=filename;dialog.nMaxFile=MAX_PATH;dialog.lpstrFilter=filter;
        dialog.lpstrDefExt=L"txt";dialog.Flags=OFN_OVERWRITEPROMPT|OFN_PATHMUSTEXIST|OFN_NOCHANGEDIR|OFN_EXPLORER;
        if(!GetSaveFileNameW(&dialog)){
            if(CommDlgExtendedError())scoped(id,"exportstatus:error:"+base64("Could not open the Save dialog."));
            else scoped(id,"exportstatus:cancelled");
            return;
        }
        std::filesystem::path path(filename);auto temp=path.parent_path()/(path.filename().wstring()+L".beipmu-"+std::to_wstring(GetCurrentProcessId())+L"-"+std::to_wstring(GetTickCount64())+L".tmp");
        std::error_code ec;
        {std::ofstream file(temp,std::ios::binary|std::ios::trunc);file.write(transcript.data(),std::streamsize(transcript.size()));file.flush();
            if(!file){file.close();std::filesystem::remove(temp,ec);scoped(id,"exportstatus:error:"+base64("Could not write the transcript."));return;}}
        if(!MoveFileExW(temp.c_str(),path.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)){
            std::filesystem::remove(temp,ec);scoped(id,"exportstatus:error:"+base64("Could not finish saving the transcript."));return;
        }
        scoped(id,"exportstatus:saved:"+base64(utf8(path.wstring())));
    }
    void exportAtlas(std::string_view encodedName,std::string_view encodedData){
        auto reply=[this](const std::string& value){message("atlasexportstatus:"+value);};
        std::string name,bytes;
        if(!unbase64(encodedName,name,160)||!validUtf8(name)||!unbase64(encodedData,bytes,4*1024*1024)||
            bytes.size()<22||bytes.compare(0,4,"PK\x03\x04",4)!=0){reply("error:"+base64("Invalid Atlas archive or size exceeds 4 MiB."));return;}
        for(char& c:name)if(static_cast<unsigned char>(c)<32||std::string_view("<>:\"/\\|?*").find(c)!=std::string_view::npos)c='_';
        if(name.empty()||name=="."||name=="..")name="World map";
        std::filesystem::path path;
        if(testMode)path=testPath/L"exported-map.atlas";
        else{
            wchar_t filename[MAX_PATH]{};auto suggested=wide(name)+L".atlas";wcsncpy_s(filename,suggested.c_str(),_TRUNCATE);
            static const wchar_t filter[]=L"BeipMU Atlas (*.atlas)\0*.atlas\0All files (*.*)\0*.*\0\0";
            OPENFILENAMEW dialog{};dialog.lStructSize=sizeof(dialog);dialog.hwndOwner=window;
            dialog.lpstrFile=filename;dialog.nMaxFile=MAX_PATH;dialog.lpstrFilter=filter;
            dialog.lpstrDefExt=L"atlas";dialog.Flags=OFN_OVERWRITEPROMPT|OFN_PATHMUSTEXIST|OFN_NOCHANGEDIR|OFN_EXPLORER;
            if(!GetSaveFileNameW(&dialog)){reply(CommDlgExtendedError()?"error:"+base64("Could not open the Save dialog."):"cancelled");return;}
            path=filename;
        }
        auto temp=path.parent_path()/(path.filename().wstring()+L".beipmu-"+std::to_wstring(GetCurrentProcessId())+L"-"+std::to_wstring(GetTickCount64())+L".tmp");
        std::error_code ec;
        {std::ofstream file(temp,std::ios::binary|std::ios::trunc);file.write(bytes.data(),std::streamsize(bytes.size()));file.flush();
            if(!file){file.close();std::filesystem::remove(temp,ec);reply("error:"+base64("Could not write the Atlas archive."));return;}
            file.close();if(!file){std::filesystem::remove(temp,ec);reply("error:"+base64("Could not close the Atlas archive."));return;}}
        if(!MoveFileExW(temp.c_str(),path.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)){
            std::filesystem::remove(temp,ec);reply("error:"+base64("Could not finish saving the Atlas archive."));return;
        }
        reply("saved:"+base64(utf8(path.wstring())));
    }
    void resize(){if(controller){RECT r;GetClientRect(window,&r);controller->put_Bounds(r);}}
    void fail(const wchar_t* text){MessageBoxW(window,text,L"BeipMU Recovery Preview",MB_OK|MB_ICONERROR);DestroyWindow(window);}
    void receive(const std::string& text){
        trace("UI",text);
        if(text.size()>1024*1024+64&&!(text.starts_with("export|")&&text.size()<=6*1024*1024)&&
            !(text.starts_with("atlasexport|")&&text.size()<=6*1024*1024)&&
            !(text.starts_with("clipboard|")&&text.size()<=10+4*((ClipboardTextLimit+2)/3))){
            message(text.starts_with("clipboard|")?"ui:clipboard-failed":"settings:error:Message is too large.");return;
        }
        if(text.starts_with("triggeraudio|"))receiveTriggerAudio(text);
        else if(text.starts_with("float:"))floating(text);
        else if(text=="menu:open")openMainMenu();
        else if(text=="clipboard:read"){std::string value;if(readClipboardText(window,value))message("clipboard:text:"+base64(value));else message("clipboard:error:Clipboard text is unavailable or exceeds 1 MiB.");}
        else if(text=="window:minimize")ShowWindow(window,SW_MINIMIZE);
        else if(text=="ready"){
            ready=true;for(auto& s:queued)message(s);queued.clear();
            if(inspectMode)message("inspect:");
            if(testPort){message("test:");legacyClient->connect(testTls?"localhost":"127.0.0.1",std::to_string(testPort),testTls);SetTimer(window,1,20000,nullptr);}
            else if(testCorePorts.size()==2){
                std::error_code ec;bool persisted=std::filesystem::exists(dataRoot()/L"settings.json",ec);
                auto config="{\"ports\":["+std::to_string(testCorePorts[0])+","+std::to_string(testCorePorts[1])+"],\"phase\":\""+(persisted?"persist":"first")+"\",\"audioPath\":"+jsonString(utf8(std::filesystem::absolute(testPath/L"test-tone.wav").wstring()))+"}";
                message("testcore:"+base64(config));SetTimer(window,1,25000,nullptr);
            }
        }else if(text.starts_with("sessionopen|")){
            auto id=text.substr(12);if(!validId(id)||sessions.find(id)!=sessions.end())return;
            if(sessions.size()>=MaxNativeSessions){scoped(id,"status:Session limit reached.");return;}
            sessions.emplace(id,std::make_unique<Client>(window,id));
        }else if(text.starts_with("connect|")){
            auto split=text.find('|',8);if(split==text.npos)return;
            auto second=text.find('|',split+1);bool legacy=second==text.npos;
            auto third=legacy?text.npos:text.find('|',second+1);
            auto fourth=third==text.npos?text.npos:text.find('|',third+1);
            auto id=legacy?std::string{}:text.substr(8,split-8);
            auto host=legacy?text.substr(8,split-8):text.substr(split+1,second-split-1);
            auto port=legacy?text.substr(split+1):text.substr(second+1,third==text.npos?text.npos:third-second-1);
            auto mode=third==text.npos?std::string{}:text.substr(third+1,fourth==text.npos?text.npos:fourth-third-1);
            auto character=fourth==text.npos?std::string{}:text.substr(fourth+1);
            bool useTls=mode=="tls";
            if(!legacy&&!validId(id)){message("status:Invalid session ID.");return;}
            auto error=[&](std::string value){if(legacy)message(value);else scoped(id,value);};
            if((!mode.empty()&&mode!="plain"&&mode!="tls")||(fourth!=text.npos&&(mode.empty()||!validId(character)))){error("status:Invalid connection mode or character.");return;}
            if(!validHost(host)||port.empty()||port.size()>5||port.find_first_not_of("0123456789")!=port.npos||std::stoul(port)==0||std::stoul(port)>65535){error("status:Enter a valid host and port.");return;}
            if(legacy)legacyClient->connect(host,port);
            else {
                if(sessions.find(id)==sessions.end()&&sessions.size()>=MaxNativeSessions){error("status:Session limit reached.");return;}
                auto& slot=sessions[id];if(!slot)slot=std::make_unique<Client>(window,id);slot->connect(host,port,useTls,std::move(character));
            }
        }else if(text=="disconnect")legacyClient->disconnect();
        else if(text.starts_with("disconnect|")){
            auto id=text.substr(11);if(!validId(id))return;
            triggerAudio.stop(id);
            auto it=sessions.find(id);if(it!=sessions.end())it->second->disconnect();
            scoped(id,"connected:off");scoped(id,"ended:");
        }else if(text.starts_with("close|")){
            auto id=text.substr(6);if(!validId(id))return;
            triggerAudio.stop(id);
            sessions.erase(id);scoped(id,"closed:");
        }else if(text.starts_with("send|")){
            auto split=text.find('|',5);
            if(split!=text.npos&&validId(std::string_view(text).substr(5,split-5))){
                auto id=text.substr(5,split-5);auto it=sessions.find(id);
                if(it!=sessions.end())it->second->command(text.substr(split+1));else scoped(id,"status:Session is closed.");
            }else legacyClient->command(text.substr(5));
        }else if(text.starts_with("emoji:"))emojiCommand(std::string_view(text).substr(6));
        else if(text=="settings:load")loadSettings();
        else if(text.starts_with("settings:save|"))saveSettings(std::string_view(text).substr(14));
        else if(text.starts_with("logchoose|")){
            auto id=text.substr(10);if(!validId(id)||!sessions.contains(id))return;
            std::wstring path;
            if(testMode&&!inspectMode)path=(testPath/L"selected-log.txt").wstring();
            else{wchar_t filename[32768]=L"BeipMU log.txt";OPENFILENAMEW dialog{};dialog.lStructSize=sizeof(dialog);dialog.hwndOwner=window;dialog.lpstrFile=filename;dialog.nMaxFile=32768;dialog.lpstrFilter=L"Text log (*.txt)\0*.txt\0HTML log (*.html)\0*.html\0Log (*.log)\0*.log\0\0";dialog.lpstrDefExt=L"txt";dialog.Flags=OFN_PATHMUSTEXIST|OFN_NOCHANGEDIR|OFN_EXPLORER;if(GetSaveFileNameW(&dialog))path=filename;}
            message("logchoice:"+id+":"+base64(utf8(path)));
        }else if(text.starts_with("logstart2|")){
            std::vector<std::string> fields;size_t at=10;while(at<=text.size()){auto end=text.find('|',at);fields.push_back(text.substr(at,end==text.npos?text.npos:end-at));if(end==text.npos)break;at=end+1;}
            if(fields.size()!=6||!validId(fields[0])||!sessions.contains(fields[0])||(fields[5]!="0"&&fields[5]!="1"))return;
            std::string values[4];for(size_t i=0;i<4;++i)if(!unbase64(fields[i+1],values[i],4096)||!validUtf8(values[i])||values[i].find('\0')!=values[i].npos)return;
            try{auto path=values[0].empty()?std::filesystem::path{}:BeipLogName::resolve(dataRoot()/L"Logs",wide(values[0]),wide(values[1]),wide(values[2]),wide(values[3]),fields[5]=="1");sessions.at(fields[0])->logStart(dataRoot(),path);}catch(const std::exception& error){scoped(fields[0],"logstatus:error:"+base64(error.what()));}
        }else if(text.starts_with("logwrite|")){
            auto split=text.find('|',9);if(split==text.npos)return;auto id=text.substr(9,split-9);if(validId(id)&&sessions.contains(id))sessions.at(id)->logWrite(std::string_view(text).substr(split+1));
        }else if(text.starts_with("logstart|")){
            auto id=text.substr(9);auto it=sessions.find(id);if(validId(id)&&it!=sessions.end())it->second->logStart(dataRoot());
        }else if(text.starts_with("logstop|")){
            auto id=text.substr(8);auto it=sessions.find(id);if(validId(id)&&it!=sessions.end())it->second->logStop();
        }else if(text.starts_with("log|")){
            auto split=text.find('|',4);if(split==text.npos)return;
            auto id=text.substr(4,split-4);auto it=sessions.find(id);
            if(validId(id)&&it!=sessions.end())it->second->logLine(std::string_view(text).substr(split+1));
        }else if(text.starts_with("telnetnop|")){
            auto id=text.substr(10);if(validId(id)&&sessions.contains(id))sessions.at(id)->telnetNop();
        }else if(text.starts_with("gmcp|")){
            auto split=text.find('|',5);if(split==text.npos)return;
            auto id=text.substr(5,split-5);auto it=sessions.find(id);
            if(validId(id)&&it!=sessions.end())it->second->gmcpSend(std::string_view(text).substr(split+1));
        }else if(text.starts_with("resize|")){
            auto split=text.find('|',7),last=split==text.npos?text.npos:text.find('|',split+1);
            if(last==text.npos)return;
            auto id=text.substr(7,split-7),width=text.substr(split+1,last-split-1),height=text.substr(last+1);
            if(!validId(id)||width.empty()||width.size()>4||height.empty()||height.size()>4||
                width.find_first_not_of("0123456789")!=width.npos||height.find_first_not_of("0123456789")!=height.npos)return;
            auto w=std::stoul(width),h=std::stoul(height);
            if(w<1||w>4096||h<1||h>4096)return;
            auto it=sessions.find(id);if(it!=sessions.end())it->second->resize((unsigned short)w,(unsigned short)h);
        }else if(text.starts_with("atlasexport|")){
            auto split=text.find('|',12);if(split==text.npos)return;
            exportAtlas(std::string_view(text).substr(12,split-12),std::string_view(text).substr(split+1));
        }else if(text.starts_with("export|")){
            auto split=text.find('|',7);if(split==text.npos)return;
            exportTranscript(text.substr(7,split-7),std::string_view(text).substr(split+1));
        }else if(text.starts_with("clipboard|")){
            message(writeClipboardText(window,std::string_view(text).substr(10))?"ui:clipboard-saved":"ui:clipboard-failed");
        }else if(text.starts_with("secret:save|")){
            auto split=text.find('|',12);if(split!=text.npos)saveSecret(text.substr(12,split-12),std::string_view(text).substr(split+1));
        }else if(text.starts_with("secret:delete|"))deleteSecret(text.substr(14));
        else if(text.starts_with("secret:status|"))secretStatus(text.substr(14));
        else if(text.starts_with("logintemplate|")){
            std::vector<std::string> fields;size_t at=14;while(at<=text.size()){auto end=text.find('|',at);fields.push_back(text.substr(at,end==text.npos?text.npos:end-at));if(end==text.npos)break;at=end+1;}
            if(fields.size()!=5||!validId(fields[0])||!validId(fields[1])||(fields[4]!="tls"&&fields[4]!="allow-plain"))return;
            auto it=sessions.find(fields[0]);if(it==sessions.end()||!it->second->mayLogin(fields[1],fields[4]=="allow-plain"))return;
            std::string username,recipe,password;if(!unbase64(fields[2],username,128)||!validLoginField(username,128)||!unbase64(fields[3],recipe,16384)||!validLoginField(recipe,16384)){scoped(fields[0],"status:Invalid connect template or login name.");return;}
            if(recipe.find("%PASSWORD%")!=recipe.npos&&!readSecret(fields[1],password)){scoped(fields[0],"status:No saved password for this connect template.");return;}
            if(password.empty()||validLoginField(password,2048))it->second->loginTemplate(recipe,username,password);
            SecureZeroMemory(password.data(),password.size());
        }
        else if(text.starts_with("login|")){
            auto split=text.find('|',6),last=split==text.npos?text.npos:text.find('|',split+1);
            if(last!=text.npos){
                auto consent=text.find('|',last+1);
                bool allowPlain=consent!=text.npos&&text.substr(consent+1)=="allow-plain";
                if(consent==text.npos||allowPlain)loginWithSecret(text.substr(6,split-6),text.substr(split+1,last-split-1),
                    std::string_view(text).substr(last+1,consent==text.npos?text.npos:consent-last-1),allowPlain);
            }
        }
        else if(text.starts_with("external|")){
            std::string url=text.substr(9);if(url.size()<=2048&&(url.starts_with("https://")||url.starts_with("http://")))ShellExecuteW(window,L"open",wide(url).c_str(),nullptr,nullptr,SW_SHOWNORMAL);
        }else if(testMode&&text.starts_with("testcapture:")){
            auto name=text.substr(12);if(!validId(name)||!view)return;
            ComPtr<IStream> stream;auto path=testPath/(wide(name)+L".png");
            HRESULT hr=SHCreateStreamOnFileEx(path.c_str(),STGM_CREATE|STGM_WRITE|STGM_SHARE_EXCLUSIVE,0,TRUE,nullptr,&stream);
            if(SUCCEEDED(hr))view->CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,stream.Get(),Callback<ICoreWebView2CapturePreviewCompletedHandler>([this,live=alive,stream,name](HRESULT result){if(*live)message(std::string(SUCCEEDED(result)?"testcaptured:":"testcapturefailed:")+name);return S_OK;}).Get());
        }else if(testMode&&text.starts_with("testresult:")){
            KillTimer(window,1);std::filesystem::create_directories(testPath);std::ofstream(testPath/"result.json",std::ios::binary)<<text.substr(11);
            captureNativeWindowEvidence(window,mainMenu,testPath);
            size_t liveFloats=0;for(auto& [id,f]:floats)if(f->hwnd)++liveFloats;
            std::ofstream(testPath/"floating-windows.json")<<"{\"created\":"<<floatCreated<<",\"ready\":"<<floatReady<<",\"closed\":"<<floatClosed<<",\"live\":"<<liveFloats<<"}";
            ComPtr<IStream> stream;HRESULT hr=SHCreateStreamOnFileEx((testPath/L"preview.png").c_str(),STGM_CREATE|STGM_WRITE|STGM_SHARE_EXCLUSIVE,0,TRUE,nullptr,&stream);
            if(SUCCEEDED(hr))view->CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,stream.Get(),Callback<ICoreWebView2CapturePreviewCompletedHandler>([this,stream](HRESULT){DestroyWindow(window);return S_OK;}).Get());
            else DestroyWindow(window);
        }
    }
    void start(){
        wchar_t executable[MAX_PATH];GetModuleFileNameW(nullptr,executable,MAX_PATH);auto ui=std::filesystem::path(executable).parent_path()/L"ui";
        uiRoot=ui;
        auto profile=dataRoot()/L"WebView";
        auto hr=CreateCoreWebView2EnvironmentWithOptions(nullptr,profile.c_str(),nullptr,Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([this,ui](HRESULT hr,ICoreWebView2Environment* env){
            if(FAILED(hr)||!env){fail(L"Microsoft Edge WebView2 Runtime is required. Install the Evergreen Runtime from Microsoft, then reopen this preview.");return S_OK;}
            environment=env;
            env->CreateCoreWebView2Controller(window,Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([this,ui](HRESULT hr,ICoreWebView2Controller* control){
                if(FAILED(hr)||!control){fail(L"Could not initialize the display.");return S_OK;}controller=control;controller->get_CoreWebView2(&view);resize();
                EventRegistrationToken token;
                view->AddWebResourceRequestedFilter(L"https://beipmu-preview.local/*",COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
                view->add_WebResourceRequested(Callback<ICoreWebView2WebResourceRequestedEventHandler>([this,ui](ICoreWebView2*,ICoreWebView2WebResourceRequestedEventArgs* args){
                    ComPtr<ICoreWebView2WebResourceRequest> request;if(FAILED(args->get_Request(&request)))return S_OK;
                    LPWSTR uri=nullptr;if(FAILED(request->get_Uri(&uri)))return S_OK;
                    std::wstring requested=uri?uri:L"";CoTaskMemFree(uri);
                    constexpr std::wstring_view origin=L"https://beipmu-preview.local/";
                    if(!requested.starts_with(origin))return S_OK;
                    auto name=std::wstring_view(requested).substr(origin.size());
                    bool safe=!name.empty()&&name.size()<=80;
                    for(wchar_t c:name)if(!((c>=L'A'&&c<=L'Z')||(c>=L'a'&&c<=L'z')||(c>=L'0'&&c<=L'9')||c==L'-'||c==L'_'||c==L'.'))safe=false;
                    bool html=name==L"index.html",css=name.ends_with(L".css"),javascript=name.ends_with(L".js");
                    safe=safe&&(html||css||javascript)&&name!=L"."&&name!=L"..";
                    std::string body;std::error_code ec;
                    if(safe){
                        auto filePath=ui/std::wstring(name);auto size=std::filesystem::file_size(filePath,ec);
                        if(!ec&&size<=512*1024){std::ifstream file(filePath,std::ios::binary);if(file)body.assign(std::istreambuf_iterator<char>(file),{});}
                    }
                    bool rules=name==L"rules-worker.js",script=name==L"script-worker.js";
                    if(rules||script)trace("WORKER",rules?"rules-worker":"script-worker");
                    if(body.empty())body="Not found";
                    ComPtr<IStream> stream;stream.Attach(SHCreateMemStream(reinterpret_cast<const BYTE*>(body.data()),UINT(body.size())));
                    ComPtr<ICoreWebView2WebResourceResponse> response;
                    std::wstring headers=html?L"Content-Type: text/html; charset=utf-8":css?L"Content-Type: text/css; charset=utf-8":L"Content-Type: application/javascript; charset=utf-8";
                    headers+=L"\r\nX-Content-Type-Options: nosniff\r\nCache-Control: no-store";
                    if(html)headers+=L"\r\nContent-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src http: https:; media-src http: https:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
                    else if(rules)headers+=L"\r\nContent-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-eval'; connect-src 'none'; worker-src 'none'";
                    else if(script)headers+=L"\r\nContent-Security-Policy: default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'; worker-src 'none'";
                    bool found=safe&&body!="Not found";
                    if(SUCCEEDED(environment->CreateWebResourceResponse(stream.Get(),found?200:404,found?L"OK":L"Not Found",headers.c_str(),&response)))args->put_Response(response.Get());
                    return S_OK;
                }).Get(),&token);
                ComPtr<ICoreWebView2Settings> settings;view->get_Settings(&settings);settings->put_AreDefaultScriptDialogsEnabled(FALSE);settings->put_AreDevToolsEnabled(FALSE);settings->put_IsStatusBarEnabled(FALSE);
                view->add_NavigationStarting(Callback<ICoreWebView2NavigationStartingEventHandler>([](ICoreWebView2*,ICoreWebView2NavigationStartingEventArgs* args){LPWSTR uri=nullptr;args->get_Uri(&uri);std::wstring url=uri?uri:L"";CoTaskMemFree(uri);if(url!=L"https://beipmu-preview.local/index.html")args->put_Cancel(TRUE);return S_OK;}).Get(),&token);
                view->add_NewWindowRequested(Callback<ICoreWebView2NewWindowRequestedEventHandler>([](ICoreWebView2*,ICoreWebView2NewWindowRequestedEventArgs* args){args->put_Handled(TRUE);return S_OK;}).Get(),&token);
                view->add_PermissionRequested(Callback<ICoreWebView2PermissionRequestedEventHandler>([](ICoreWebView2*,ICoreWebView2PermissionRequestedEventArgs* args){args->put_State(COREWEBVIEW2_PERMISSION_STATE_DENY);return S_OK;}).Get(),&token);
                view->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>([this](ICoreWebView2*,ICoreWebView2WebMessageReceivedEventArgs* args){
                    LPWSTR source=nullptr;args->get_Source(&source);bool trusted=source&&std::wstring(source)==L"https://beipmu-preview.local/index.html";CoTaskMemFree(source);
                    LPWSTR data=nullptr;if(trusted&&SUCCEEDED(args->TryGetWebMessageAsString(&data))){receive(utf8(data));CoTaskMemFree(data);}return S_OK;
                }).Get(),&token);
                view->Navigate(L"https://beipmu-preview.local/index.html");return S_OK;
            }).Get());return S_OK;
        }).Get());
        if(FAILED(hr))fail(L"Could not start WebView2.");
    }
};
LRESULT CALLBACK windowProc(HWND window,UINT message,WPARAM w,LPARAM l){
    auto app=(Application*)GetWindowLongPtrW(window,GWLP_USERDATA);
    if(message==WM_NCCREATE){app=(Application*)((CREATESTRUCTW*)l)->lpCreateParams;app->window=window;app->legacyClient=std::make_unique<Client>(window,"legacy",true);app->initializeTriggerAudio();SetWindowLongPtrW(window,GWLP_USERDATA,(LONG_PTR)app);}
    if(app){if(message==NetworkMessage){auto event=(Event*)l;app->message(event->text);delete event;return 0;}
        if(message==TriggerAudioMessage){app->triggerAudio.poll();return 0;}
        if(message==WM_COMMAND&&HIWORD(w)==0){
            if(LOWORD(w)==FileExit){PostMessageW(window,WM_CLOSE,0,0);return 0;}
            if(const char* action=menuAction(LOWORD(w))){app->message(action);return 0;}
        }
        if(message==WM_SIZE){app->resize();return 0;}if(message==WM_TIMER&&w==2){app->captureFloating();return 0;}if(message==WM_TIMER){std::filesystem::create_directories(app->testPath);std::ofstream(app->testPath/"timeout.txt")<<"Preview self-test timed out";DestroyWindow(window);return 0;}
        if(message==WM_DESTROY){app->triggerAudio.shutdown();*app->alive=false;for(auto& [id,f]:app->floats)if(f->hwnd)DestroyWindow(f->hwnd);app->floats.clear();app->sessions.clear();app->legacyClient.reset();for(auto& [id,secret]:app->testSecrets)SecureZeroMemory(secret.data(),secret.size());app->testSecrets.clear();if(app->mainMenu){DestroyMenu(app->mainMenu);app->mainMenu=nullptr;}if(app->controller)app->controller->Close();PostQuitMessage(0);return 0;}}
    return DefWindowProcW(window,message,w,l);
}
int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,PWSTR,int show){
    CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);WSADATA ws{};if(WSAStartup(MAKEWORD(2,2),&ws))return 1;
    Application app;int argc=0;auto argv=CommandLineToArgvW(GetCommandLineW(),&argc);
    if(argc==3&&std::wstring(argv[1])==L"--inspect"){app.inspectMode=true;app.testMode=true;app.testPath=argv[2];}
    if(argc==4&&(std::wstring(argv[1])==L"--test"||std::wstring(argv[1])==L"--test-tls")){
        app.testPort=_wtoi(argv[2]);app.testMode=app.testPort>0;app.testTls=std::wstring(argv[1])==L"--test-tls";app.testPath=argv[3];
    }else if(argc==5&&std::wstring(argv[1])==L"--test-core"){
        int first=_wtoi(argv[2]),second=_wtoi(argv[3]);
        if(first>0&&first<=65535&&second>0&&second<=65535){app.testCorePorts={first,second};app.testMode=true;app.testPath=argv[4];}
    }
    LocalFree(argv);
    WNDCLASSW wc{};wc.hInstance=instance;wc.lpszClassName=L"BeipMURecoveryPreview";wc.lpfnWndProc=windowProc;wc.hCursor=LoadCursorW(nullptr,IDC_ARROW);wc.hIcon=LoadIconW(nullptr,IDI_APPLICATION);RegisterClassW(&wc);
    app.mainMenu=createMainPopup();
    auto window=CreateWindowExW(0,wc.lpszClassName,L"BeipMU Recovery 0.11",WS_OVERLAPPEDWINDOW,CW_USEDEFAULT,CW_USEDEFAULT,1080,820,nullptr,nullptr,instance,&app);
    if(!window&&app.mainMenu)DestroyMenu(app.mainMenu);
    if(!window)return 1;ShowWindow(window,show);app.start();MSG msg;while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}
    // Drain queued network events after the worker has stopped.
    while(PeekMessageW(&msg,window,NetworkMessage,NetworkMessage,PM_REMOVE))delete (Event*)msg.lParam;
    app.view.Reset();app.controller.Reset();WSACleanup();CoUninitialize();return 0;
}
