#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <shellapi.h>
#include <wrl.h>
#include <WebView2.h>
#include <atomic>
#include <mutex>
#include <thread>
#include <string>
#include <vector>
#include <fstream>
#include <filesystem>
#include "protocol.h"

using Microsoft::WRL::ComPtr;
using Microsoft::WRL::Callback;
static constexpr UINT NetworkMessage=WM_APP+1;
struct Event {std::string text;};
std::wstring wide(std::string_view s) {
    int n=MultiByteToWideChar(CP_UTF8,0,s.data(),int(s.size()),nullptr,0);
    std::wstring out(n,0);MultiByteToWideChar(CP_UTF8,0,s.data(),int(s.size()),out.data(),n);return out;
}
std::string utf8(std::wstring_view s) {
    int n=WideCharToMultiByte(CP_UTF8,0,s.data(),int(s.size()),nullptr,0,nullptr,nullptr);
    std::string out(n,0);WideCharToMultiByte(CP_UTF8,0,s.data(),int(s.size()),out.data(),n,nullptr,nullptr);return out;
}
std::string base64(std::string_view s) {
    static const char alphabet[]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string out;unsigned value=0;int bits=-6;
    for(unsigned char c:s){value=(value<<8)|c;bits+=8;while(bits>=0){out+=alphabet[(value>>bits)&63];bits-=6;}}
    if(bits>-6)out+=alphabet[((value<<8)>>(bits+8))&63];while(out.size()%4)out+='=';return out;
}
class Client {
    HWND window=nullptr;SOCKET socket=INVALID_SOCKET;std::mutex lock;
    std::thread worker;std::atomic<bool> stop{false};
    void post(std::string s){auto event=new Event{std::move(s)};if(!PostMessageW(window,NetworkMessage,0,(LPARAM)event))delete event;}
    bool transmit(std::string_view s){std::lock_guard guard(lock);if(socket==INVALID_SOCKET)return false;while(!s.empty()){int n=send(socket,s.data(),int(s.size()),0);if(n<=0)return false;s.remove_prefix(n);}return true;}
public:
    void attach(HWND w){window=w;}
    void disconnect(){stop=true;{std::lock_guard guard(lock);if(socket!=INVALID_SOCKET)shutdown(socket,SD_BOTH);}if(worker.joinable())worker.join();{std::lock_guard guard(lock);if(socket!=INVALID_SOCKET){closesocket(socket);socket=INVALID_SOCKET;}}}
    ~Client(){disconnect();}
    void command(std::string s){if(s.size()>8192||s.find('\n')!=s.npos||s.find('\r')!=s.npos){post("status:Command rejected: one line at a time, up to 8192 bytes.");return;}s+="\r\n";if(!transmit(escapeTelnet(s)))post("status:Not connected.");}
    void connect(std::string host,std::string port){
        disconnect();stop=false;
        worker=std::thread([this,host=std::move(host),port=std::move(port)]{
            post("reset:");post("status:Connecting to "+host+":"+port+"...");
            addrinfo hints{},*addresses=nullptr;hints.ai_socktype=SOCK_STREAM;hints.ai_family=AF_UNSPEC;
            if(getaddrinfo(host.c_str(),port.c_str(),&hints,&addresses)){post("status:Could not resolve the server address.");return;}
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
            if(connected==INVALID_SOCKET){post("status:Connection failed.");return;}
            {std::lock_guard guard(lock);socket=connected;}
            post("status:Connected to "+host+":"+port+" (plain TCP).");
            TelnetStream telnet;
            telnet.output=[this](std::string_view s){post("data:"+base64(s));};
            telnet.reply=[this](std::string_view s){transmit(s);};
            telnet.mxp=[this](bool enabled){post(enabled?"mxp:on":"mxp:off");};
            char buffer[16384];
            while(!stop){int n=recv(connected,buffer,sizeof(buffer),0);if(n==0)break;if(n<0){int error=WSAGetLastError();if(error==WSAETIMEDOUT||error==WSAEWOULDBLOCK)continue;break;}telnet.feed(std::string_view(buffer,n));}
            {std::lock_guard guard(lock);if(socket==connected){closesocket(socket);socket=INVALID_SOCKET;}}
            post("ended:");post("status:Disconnected.");
        });
    }
};
struct Application {
    HWND window=nullptr;Client client;ComPtr<ICoreWebView2Controller> controller;ComPtr<ICoreWebView2> view;
    std::filesystem::path testPath;int testPort=0;bool ready=false;std::vector<std::string> queued;
    void trace(const std::string& text){if(testPort){std::filesystem::create_directories(testPath);std::ofstream(testPath/"trace.txt",std::ios::app)<<text<<"\n";}}
    void message(const std::string& text){trace("HOST "+text.substr(0,100));if(view&&ready)view->PostWebMessageAsString(wide(text).c_str());else if(queued.size()<256)queued.push_back(text);}
    void resize(){if(controller){RECT r;GetClientRect(window,&r);controller->put_Bounds(r);}}
    void fail(const wchar_t* text){MessageBoxW(window,text,L"BeipMU Recovery Preview",MB_OK|MB_ICONERROR);DestroyWindow(window);}
    void receive(const std::string& text){
        trace("UI "+text.substr(0,100));
        if(text=="ready"){
            ready=true;for(auto& s:queued)message(s);queued.clear();
            if(testPort){message("test:");client.connect("127.0.0.1",std::to_string(testPort));SetTimer(window,1,20000,nullptr);}
        }else if(text.starts_with("connect|")){
            auto split=text.find('|',8);if(split==text.npos)return;
            auto host=text.substr(8,split-8),port=text.substr(split+1);
            if(host.empty()||host.size()>253||port.empty()||port.size()>5||port.find_first_not_of("0123456789")!=port.npos||std::stoul(port)==0||std::stoul(port)>65535){message("status:Enter a valid host and port.");return;}
            client.connect(host,port);
        }else if(text=="disconnect")client.disconnect();
        else if(text.starts_with("send|"))client.command(text.substr(5));
        else if(text.starts_with("external|")){
            std::string url=text.substr(9);if(url.starts_with("https://")||url.starts_with("http://"))ShellExecuteW(window,L"open",wide(url).c_str(),nullptr,nullptr,SW_SHOWNORMAL);
        }else if(testPort&&text.starts_with("testresult:")){
            KillTimer(window,1);std::filesystem::create_directories(testPath);std::ofstream(testPath/"result.json",std::ios::binary)<<text.substr(11);
            ComPtr<IStream> stream;HRESULT hr=SHCreateStreamOnFileEx((testPath/L"preview.png").c_str(),STGM_CREATE|STGM_WRITE|STGM_SHARE_EXCLUSIVE,0,TRUE,nullptr,&stream);
            if(SUCCEEDED(hr))view->CapturePreview(COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,stream.Get(),Callback<ICoreWebView2CapturePreviewCompletedHandler>([this,stream](HRESULT){DestroyWindow(window);return S_OK;}).Get());
            else DestroyWindow(window);
        }
    }
    void start(){
        wchar_t executable[MAX_PATH];GetModuleFileNameW(nullptr,executable,MAX_PATH);auto ui=std::filesystem::path(executable).parent_path()/L"ui";
        PWSTR local=nullptr;SHGetKnownFolderPath(FOLDERID_LocalAppData,0,nullptr,&local);auto profile=std::filesystem::path(local?local:L".")/L"BeipMU-Recovery"/L"WebView";CoTaskMemFree(local);
        auto hr=CreateCoreWebView2EnvironmentWithOptions(nullptr,profile.c_str(),nullptr,Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([this,ui](HRESULT hr,ICoreWebView2Environment* env){
            if(FAILED(hr)||!env){fail(L"Microsoft Edge WebView2 Runtime is required. Install the Evergreen Runtime from Microsoft, then reopen this preview.");return S_OK;}
            env->CreateCoreWebView2Controller(window,Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([this,ui](HRESULT hr,ICoreWebView2Controller* control){
                if(FAILED(hr)||!control){fail(L"Could not initialize the display.");return S_OK;}controller=control;controller->get_CoreWebView2(&view);resize();
                ComPtr<ICoreWebView2_3> mapping;view.As(&mapping);if(!mapping){fail(L"Please update the WebView2 Runtime.");return S_OK;}
                mapping->SetVirtualHostNameToFolderMapping(L"beipmu-preview.local",ui.c_str(),COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS);
                ComPtr<ICoreWebView2Settings> settings;view->get_Settings(&settings);settings->put_AreDefaultScriptDialogsEnabled(FALSE);settings->put_AreDevToolsEnabled(FALSE);settings->put_IsStatusBarEnabled(FALSE);
                EventRegistrationToken token;
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
    if(message==WM_NCCREATE){app=(Application*)((CREATESTRUCTW*)l)->lpCreateParams;app->window=window;app->client.attach(window);SetWindowLongPtrW(window,GWLP_USERDATA,(LONG_PTR)app);}
    if(app){if(message==NetworkMessage){auto event=(Event*)l;app->message(event->text);delete event;return 0;}
        if(message==WM_SIZE){app->resize();return 0;}if(message==WM_TIMER){std::filesystem::create_directories(app->testPath);std::ofstream(app->testPath/"timeout.txt")<<"Preview self-test timed out";DestroyWindow(window);return 0;}
        if(message==WM_DESTROY){app->client.disconnect();if(app->controller)app->controller->Close();PostQuitMessage(0);return 0;}}
    return DefWindowProcW(window,message,w,l);
}
int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,PWSTR,int show){
    CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);WSADATA ws{};if(WSAStartup(MAKEWORD(2,2),&ws))return 1;
    Application app;int argc=0;auto argv=CommandLineToArgvW(GetCommandLineW(),&argc);if(argc==4&&std::wstring(argv[1])==L"--test"){app.testPort=_wtoi(argv[2]);app.testPath=argv[3];}LocalFree(argv);
    WNDCLASSW wc{};wc.hInstance=instance;wc.lpszClassName=L"BeipMURecoveryPreview";wc.lpfnWndProc=windowProc;wc.hCursor=LoadCursorW(nullptr,IDC_ARROW);wc.hIcon=LoadIconW(nullptr,IDI_APPLICATION);RegisterClassW(&wc);
    auto window=CreateWindowExW(0,wc.lpszClassName,L"BeipMU Recovery Preview 0.2",WS_OVERLAPPEDWINDOW,CW_USEDEFAULT,CW_USEDEFAULT,1080,820,nullptr,nullptr,instance,&app);
    if(!window)return 1;ShowWindow(window,show);app.start();MSG msg;while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}
    // Drain queued network events after the worker has stopped.
    while(PeekMessageW(&msg,window,NetworkMessage,NetworkMessage,PM_REMOVE))delete (Event*)msg.lParam;
    app.view.Reset();app.controller.Reset();WSACleanup();CoUninitialize();return 0;
}
