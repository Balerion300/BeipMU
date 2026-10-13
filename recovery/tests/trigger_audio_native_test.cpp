#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "../trigger-audio.h"
#include <cassert>
#include <chrono>
#include <fstream>
#include <iostream>
#include <vector>
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "oleaut32.lib")
#pragma comment(lib, "user32.lib")
struct Evidence { std::string owner, action, status; ULONG stream; };
int main() {
    assert(SUCCEEDED(CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED)));
    HWND window=CreateWindowExW(0,L"STATIC",L"Audio test",0,0,0,0,0,HWND_MESSAGE,nullptr,GetModuleHandleW(nullptr),nullptr);
    assert(window);
    std::vector<Evidence> events;
    TriggerAudio audio;
    audio.initialize(window,WM_APP+3,[&](auto& owner,auto& action,auto& status,ULONG stream,const std::wstring&){
        events.push_back({owner,action,status,stream});
        std::cout<<owner<<" "<<action<<" "<<status<<" "<<stream<<std::endl;
    });
    auto has=[&](const char* owner,const char* action,const char* status){for(auto& e:events)if(e.owner==owner&&e.action==action&&e.status==status)return true;return false;};
    auto pump=[&](unsigned millis){auto deadline=GetTickCount64()+millis;do{MSG message;while(PeekMessageW(&message,nullptr,0,0,PM_REMOVE)){TranslateMessage(&message);DispatchMessageW(&message);}audio.poll();Sleep(10);}while(GetTickCount64()<deadline);};
    assert(TriggerAudio::validPath(L"C:\\Audio\\bell.wav"));
    for(auto path:{L"https://bad/a.wav",L"\\\\server\\a.wav",L"\\\\?\\C:\\a.wav",L"C:/../a.wav",L"C:/a.wav:stream.wav",L"C:/a.mp3"})assert(!TriggerAudio::validPath(path));
    assert(!TriggerAudio::validText(std::wstring(2049,L'x')));
    audio.sound("first",L"https://bad/a.wav");assert(has("first","sound","invalid-path"));
    // A finite, low-amplitude WAV tests the real Win32 API without claiming subjective audibility.
    wchar_t temp[MAX_PATH]{};assert(GetTempPathW(MAX_PATH,temp));
    auto path=std::filesystem::path(temp)/(L"beip-trigger-audio-"+std::to_wstring(GetCurrentProcessId())+L".wav");
    {
        std::ofstream f(path,std::ios::binary);auto u16=[&](unsigned n){f.put(char(n));f.put(char(n>>8));};auto u32=[&](unsigned n){u16(n);u16(n>>16);};
        f.write("RIFF",4);u32(36+1600);f.write("WAVEfmt ",8);u32(16);u16(1);u16(1);u32(8000);u32(16000);u16(2);u16(16);f.write("data",4);u32(1600);
        for(unsigned i=0;i<800;++i)u16(i%20<10?1000:unsigned(-1000));
    }
    audio.sound("first",path.wstring());assert(has("first","sound","api-accepted"));
    audio.stop("other");assert(!has("first","sound","stopped"));
    audio.stop("first");assert(has("first","sound","stopped"));
    // Literal XML-looking text must not activate SAPI audio markup.
    audio.speech("first",L"Beip audio test.");
    for(unsigned i=0;i<300&&!has("first","speech","ended");++i)pump(20);
    assert(has("first","speech","started"));assert(has("first","speech","ended"));
    for(int i=0;i<9;++i)audio.speech("queue",L"This bounded queue is immediately stopped by the audio test.");
    assert(has("queue","speech","queue-full"));
    audio.speech("other",L"Other session.");audio.stop("queue");
    assert(!has("other","speech","stopped"));assert(has("queue","speech","stopped"));
    audio.shutdown();assert(has("other","speech","stopped"));
    DestroyWindow(window);std::error_code error;std::filesystem::remove(path,error);CoUninitialize();
    std::cout<<"Native WAV and SAPI acceptance, start/end, queue bound, and owner stop checks passed.\n";
}
