#pragma once
#include <windows.h>
#include <winhttp.h>
#include <wincodec.h>
#include <wrl.h>
#include <string>
#include <vector>
#include <chrono>
#include <stdexcept>
#include <limits>
#include <cstring>

// Independent recovery image transfer. No browser cookies, cached credentials or
// authentication negotiation are copied to this explicit user action.
namespace BeipNativeImage {
constexpr size_t MaxBytes=16*1024*1024, MaxPixels=16*1024*1024;
struct Handle {
 HINTERNET value=nullptr;
 explicit Handle(HINTERNET h=nullptr):value(h){}
 ~Handle(){if(value)WinHttpCloseHandle(value);}
 Handle(const Handle&)=delete;Handle& operator=(const Handle&)=delete;
 operator HINTERNET()const{return value;}
};
struct URL {std::wstring host,path;INTERNET_PORT port=0;bool secure=false;};
inline URL parseURL(const std::wstring& value){
 if(value.empty()||value.size()>8192||value.find_first_of(L"\r\n\t")!=value.npos||value.find(L'\0')!=value.npos)throw std::runtime_error("Invalid image URL.");
 URL_COMPONENTS parts{};parts.dwStructSize=sizeof(parts);parts.dwSchemeLength=parts.dwHostNameLength=parts.dwUrlPathLength=parts.dwExtraInfoLength=parts.dwUserNameLength=parts.dwPasswordLength=DWORD(-1);
 if(!WinHttpCrackUrl(value.c_str(),DWORD(value.size()),0,&parts)||!parts.dwHostNameLength||parts.dwUserNameLength||parts.dwPasswordLength||(parts.nScheme!=INTERNET_SCHEME_HTTP&&parts.nScheme!=INTERNET_SCHEME_HTTPS))throw std::runtime_error("Image actions require an HTTP or HTTPS URL without embedded credentials.");
 URL result;result.host.assign(parts.lpszHostName,parts.dwHostNameLength);result.path.assign(parts.lpszUrlPath,parts.dwUrlPathLength);if(result.path.empty())result.path=L"/";
 if(parts.dwExtraInfoLength)result.path.append(parts.lpszExtraInfo,parts.dwExtraInfoLength);
 if(auto hash=result.path.find(L'#');hash!=result.path.npos)result.path.resize(hash);
 result.port=parts.nPort;result.secure=parts.nScheme==INTERNET_SCHEME_HTTPS;return result;
}
struct Result {std::vector<unsigned char> bytes,pixels;UINT width=0,height=0;std::wstring extension;std::string error;};
inline void decode(Result& result){
 using Microsoft::WRL::ComPtr;
 if(result.bytes.empty()||result.bytes.size()>MaxBytes)throw std::runtime_error("Image size is outside the 16 MiB limit.");
 ComPtr<IWICImagingFactory> factory;ComPtr<IWICStream> stream;ComPtr<IWICBitmapDecoder> decoder;ComPtr<IWICBitmapFrameDecode> frame;ComPtr<IWICFormatConverter> converter;
 if(FAILED(CoCreateInstance(CLSID_WICImagingFactory,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&factory)))||FAILED(factory->CreateStream(&stream))||FAILED(stream->InitializeFromMemory(result.bytes.data(),DWORD(result.bytes.size())))||FAILED(factory->CreateDecoderFromStream(stream.Get(),nullptr,WICDecodeMetadataCacheOnDemand,&decoder)))throw std::runtime_error("Windows could not decode this image format.");
 GUID kind{};if(FAILED(decoder->GetContainerFormat(&kind)))throw std::runtime_error("Could not identify the image format.");
 if(IsEqualGUID(kind,GUID_ContainerFormatPng))result.extension=L"png";
 else if(IsEqualGUID(kind,GUID_ContainerFormatJpeg))result.extension=L"jpg";
 else if(IsEqualGUID(kind,GUID_ContainerFormatGif))result.extension=L"gif";
 else if(IsEqualGUID(kind,GUID_ContainerFormatBmp))result.extension=L"bmp";
 else if(IsEqualGUID(kind,GUID_ContainerFormatTiff))result.extension=L"tif";
 else if(IsEqualGUID(kind,GUID_ContainerFormatIco))result.extension=L"ico";
 else throw std::runtime_error("Save and Copy support PNG, JPEG, GIF, BMP, TIFF and ICO images.");
 if(FAILED(decoder->GetFrame(0,&frame))||FAILED(frame->GetSize(&result.width,&result.height))||!result.width||!result.height||size_t(result.width)*result.height>MaxPixels)throw std::runtime_error("Decoded image exceeds the 16 megapixel limit.");
 result.pixels.resize(size_t(result.width)*result.height*4);
 if(FAILED(factory->CreateFormatConverter(&converter))||FAILED(converter->Initialize(frame.Get(),GUID_WICPixelFormat32bppBGRA,WICBitmapDitherTypeNone,nullptr,0,WICBitmapPaletteTypeCustom))||FAILED(converter->CopyPixels(nullptr,result.width*4,UINT(result.pixels.size()),result.pixels.data())))throw std::runtime_error("Could not decode the image pixels.");
}
inline Result fetch(const std::wstring& value){
 Result result;const HRESULT initialized=CoInitializeEx(nullptr,COINIT_MULTITHREADED);
 try{
  if(FAILED(initialized))throw std::runtime_error("Could not initialize the image decoder.");
  const auto url=parseURL(value);Handle session(WinHttpOpen(L"BeipMU-Recovery image action",WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,WINHTTP_NO_PROXY_NAME,WINHTTP_NO_PROXY_BYPASS,0));
  if(!session||!WinHttpSetTimeouts(session,5000,5000,5000,5000))throw std::runtime_error("Could not start the image request.");
  Handle connection(WinHttpConnect(session,url.host.c_str(),url.port,0));Handle request(connection?WinHttpOpenRequest(connection,L"GET",url.path.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,url.secure?WINHTTP_FLAG_SECURE:0):nullptr);
  if(!request)throw std::runtime_error("Could not create the image request.");
  DWORD disabled=WINHTTP_DISABLE_COOKIES|WINHTTP_DISABLE_AUTHENTICATION|WINHTTP_DISABLE_REDIRECTS;
  if(!WinHttpSetOption(request,WINHTTP_OPTION_DISABLE_FEATURE,&disabled,sizeof(disabled)))throw std::runtime_error("Could not configure the image request.");
  DWORD autoLogon=WINHTTP_AUTOLOGON_SECURITY_LEVEL_HIGH;WinHttpSetOption(request,WINHTTP_OPTION_AUTOLOGON_POLICY,&autoLogon,sizeof(autoLogon));
  if(!WinHttpSendRequest(request,WINHTTP_NO_ADDITIONAL_HEADERS,0,WINHTTP_NO_REQUEST_DATA,0,0,0)||!WinHttpReceiveResponse(request,nullptr))throw std::runtime_error("Image download failed or timed out.");
  DWORD status=0,size=sizeof(status);if(!WinHttpQueryHeaders(request,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,WINHTTP_HEADER_NAME_BY_INDEX,&status,&size,WINHTTP_NO_HEADER_INDEX)||status!=200)throw std::runtime_error("Image server did not return a direct successful response.");
  const auto deadline=std::chrono::steady_clock::now()+std::chrono::seconds(15);
  for(;;){if(std::chrono::steady_clock::now()>deadline)throw std::runtime_error("Image download timed out.");unsigned char block[32768];DWORD count=0;if(!WinHttpReadData(request,block,sizeof(block),&count))throw std::runtime_error("Could not finish the image download.");if(!count)break;if(result.bytes.size()+count>MaxBytes)throw std::runtime_error("Image exceeds the 16 MiB download limit.");result.bytes.insert(result.bytes.end(),block,block+count);}
  decode(result);
 }catch(const std::exception& e){result.error=e.what();result.bytes.clear();result.pixels.clear();}
 if(SUCCEEDED(initialized))CoUninitialize();return result;
}
inline std::vector<unsigned char> dib(const Result& result){
 if(!result.error.empty()||!result.width||!result.height||result.pixels.size()!=size_t(result.width)*result.height*4)throw std::runtime_error("Invalid decoded image.");
 BITMAPV5HEADER header{};header.bV5Size=sizeof(header);header.bV5Width=LONG(result.width);header.bV5Height=-LONG(result.height);header.bV5Planes=1;header.bV5BitCount=32;header.bV5Compression=BI_BITFIELDS;header.bV5SizeImage=DWORD(result.pixels.size());header.bV5RedMask=0x00ff0000;header.bV5GreenMask=0x0000ff00;header.bV5BlueMask=0x000000ff;header.bV5AlphaMask=0xff000000;header.bV5CSType=LCS_sRGB;
 std::vector<unsigned char> bytes(sizeof(header)+result.pixels.size());std::memcpy(bytes.data(),&header,sizeof(header));std::memcpy(bytes.data()+sizeof(header),result.pixels.data(),result.pixels.size());return bytes;
}
inline bool copy(HWND owner,const Result& result){
 const auto bytes=dib(result);HGLOBAL block=GlobalAlloc(GMEM_MOVEABLE,bytes.size());if(!block)return false;void* target=GlobalLock(block);if(!target){GlobalFree(block);return false;}std::memcpy(target,bytes.data(),bytes.size());GlobalUnlock(block);
 if(!OpenClipboard(owner)){GlobalFree(block);return false;}const bool okay=EmptyClipboard()&&SetClipboardData(CF_DIBV5,block);CloseClipboard();if(!okay)GlobalFree(block);return okay;
}
}
