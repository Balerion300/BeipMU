#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "../native-restore.h"
#include "../native-image.h"
#include <iostream>
#include <cassert>
template<class F>void rejects(F f){bool rejected=false;try{f();}catch(const std::exception&){rejected=true;}if(!rejected)throw std::runtime_error("Expected rejection.");}
int wmain(int argc,wchar_t** argv){
 try{
  if(argc!=3)throw std::runtime_error("Supply isolated storage folder and GIF fixture.");
  const std::filesystem::path root=argv[1];std::filesystem::create_directories(root);
  BeipRestore::Store store(root);assert(store.load("alpha",65536).records.empty());
  rejects([&]{store.load("../other",65536);});rejects([&]{store.append("alpha",65536,"not JSON");});
  const std::string first="{\"v\":1,\"kind\":\"history\",\"text\":\"before\"}";
  store.append("alpha",65536,first);store.append("beta",65536,"{\"owner\":\"beta\"}");store.flush("alpha");store.flush("beta");
  BeipRestore::Store reopen(root);assert(reopen.load("alpha",65536).records.front()==first);assert(reopen.load("beta",65536).records.size()==1);
  const std::string record="{\"text\":\""+std::string(32750,'x')+"\"}";
  store.append("alpha",65536,record);store.append("alpha",65536,record);store.append("alpha",65536,record);store.flush("alpha");
  BeipRestore::Store bounded(root);const auto& limited=bounded.load("alpha",65536);assert(limited.bytes<=65536&&limited.records.size()==2&&limited.records.front()==record);
  {std::ofstream bad(root/L"bad.restore",std::ios::binary);bad<<"BEIPRST1\n";uint32_t tooLarge=100000;bad.write(reinterpret_cast<char*>(&tooLarge),4);}
  rejects([&]{store.load("bad",65536);});const auto corruptSize=std::filesystem::file_size(root/L"bad.restore");rejects([&]{store.append("bad",65536,first);});assert(std::filesystem::file_size(root/L"bad.restore")==corruptSize);
  store.clear("bad");store.append("bad",65536,first);store.flush("bad");
  const auto url=BeipNativeImage::parseURL(L"https://example.org:8443/image.gif?x=1#part");assert(url.secure&&url.port==8443&&url.path==L"/image.gif?x=1");
  rejects([]{BeipNativeImage::parseURL(L"file:///C:/secret");});rejects([]{BeipNativeImage::parseURL(L"https://name:password@example.org/image");});
  HRESULT hr=CoInitializeEx(nullptr,COINIT_MULTITHREADED);if(FAILED(hr))throw std::runtime_error("COM setup failed.");
  BeipNativeImage::Result image;{std::ifstream input(argv[2],std::ios::binary);image.bytes.assign(std::istreambuf_iterator<char>(input),{});}BeipNativeImage::decode(image);assert(image.width==32&&image.height==16&&image.extension==L"gif");
  const auto dib=BeipNativeImage::dib(image);BITMAPV5HEADER header{};std::memcpy(&header,dib.data(),sizeof(header));assert(header.bV5Width==32&&header.bV5Height==-16&&header.bV5AlphaMask==0xff000000&&dib.size()==sizeof(header)+32*16*4);
  BeipNativeImage::Result malformed;malformed.bytes={1,2,3};rejects([&]{BeipNativeImage::decode(malformed);});CoUninitialize();
  store.clear("alpha");store.clear("beta");store.clear("bad");std::filesystem::remove(root);
  std::cout<<"PASS bounded native restore, corruption preservation, owner storage, URL validation and decoded GIF/DIB bytes\n";return 0;
 }catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
