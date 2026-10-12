#pragma once
#include <windows.h>
#include <filesystem>
#include <fstream>
#include <deque>
#include <unordered_map>
#include <string>
#include <stdexcept>
#include <cstdint>
#include <cstring>

// Recovery-only structured records. Original Restore.dat is never opened here.
namespace BeipRestore {
constexpr size_t MaxRecord=60*1024,MaxBuffer=4096*1024;
inline bool safeId(std::string_view id){if(id.empty()||id.size()>64)return false;for(unsigned char c:id)if(!((c>='a'&&c<='z')||(c>='A'&&c<='Z')||(c>='0'&&c<='9')||c=='-'||c=='_'))return false;return true;}
inline bool validRecord(std::string_view data){return !data.empty()&&data.size()<=MaxRecord&&data.front()=='{'&&data.back()=='}'&&data.find('\0')==data.npos&&MultiByteToWideChar(CP_UTF8,MB_ERR_INVALID_CHARS,data.data(),int(data.size()),nullptr,0)>0;}
struct Buffer {std::deque<std::string> records;size_t bytes=0,limit=256*1024;bool dirty=false,loaded=false,blocked=false;};
class Store {
 std::filesystem::path root;std::unordered_map<std::string,Buffer> buffers;
 std::filesystem::path path(const std::string& id)const{if(!safeId(id))throw std::runtime_error("Invalid restore character.");return root/(std::wstring(id.begin(),id.end())+L".restore");}
 static void trim(Buffer& buffer){while((buffer.bytes>buffer.limit||buffer.records.size()>10000)&&!buffer.records.empty()){buffer.bytes-=buffer.records.front().size()+4;buffer.records.pop_front();buffer.dirty=true;}}
public:
 explicit Store(std::filesystem::path folder={}):root(std::move(folder)){}
 void setRoot(const std::filesystem::path& folder){if(!buffers.empty())throw std::runtime_error("Restore folder already in use.");root=folder;}
 Buffer& load(const std::string& id,size_t limit){
  if(limit<64*1024||limit>MaxBuffer||limit%(64*1024))throw std::runtime_error("Invalid restore buffer size.");
  const auto filePath=path(id);auto& buffer=buffers[id];buffer.limit=limit;
  if(buffer.loaded){if(buffer.blocked)throw std::runtime_error("Restore file needs review or explicit clearing after a read error.");trim(buffer);return buffer;}
  buffer.loaded=true;std::error_code error;
  if(!std::filesystem::exists(filePath,error)&&!error)return buffer;
  try{
   const auto size=std::filesystem::file_size(filePath,error);if(error||size>MaxBuffer+9)throw std::runtime_error("Restore file is inaccessible or exceeds its storage limit.");
   std::ifstream input(filePath,std::ios::binary);char magic[9]{};if(!input.read(magic,9)||std::memcmp(magic,"BEIPRST1\n",9))throw std::runtime_error("Restore file has an invalid header.");
   size_t consumed=9;while(consumed<size){uint32_t length=0;if(size-consumed<4||!input.read(reinterpret_cast<char*>(&length),4)||length>MaxRecord||!length||length>size-consumed-4)throw std::runtime_error("Restore file has a truncated or oversized record.");std::string record(length,'\0');if(!input.read(record.data(),length)||!validRecord(record))throw std::runtime_error("Restore file contains an invalid record.");buffer.records.push_back(std::move(record));buffer.bytes+=length+4;consumed+=length+4;}
   trim(buffer);return buffer;
  }catch(...){buffer.records.clear();buffer.bytes=0;buffer.blocked=true;buffer.dirty=false;throw;}
 }
 void append(const std::string& id,size_t limit,std::string data){if(!validRecord(data))throw std::runtime_error("Restore record must be a UTF-8 object of at most 60 KiB.");auto& buffer=load(id,limit);buffer.bytes+=data.size()+4;buffer.records.push_back(std::move(data));buffer.dirty=true;trim(buffer);}
 void clear(const std::string& id){std::error_code error;std::filesystem::remove(path(id),error);if(error)throw std::runtime_error("Could not clear character restoration.");buffers.erase(id);}
 void flush(const std::string& id){
  const auto it=buffers.find(id);if(it==buffers.end()||!it->second.dirty||it->second.blocked)return;auto& buffer=it->second;std::error_code error;std::filesystem::create_directories(root,error);if(error)throw std::runtime_error("Could not create the restore folder.");
  const auto target=path(id),temp=root/(std::wstring(id.begin(),id.end())+L"-"+std::to_wstring(GetCurrentProcessId())+L".tmp");
  {std::ofstream output(temp,std::ios::binary|std::ios::trunc);output.write("BEIPRST1\n",9);for(const auto& record:buffer.records){const uint32_t length=uint32_t(record.size());output.write(reinterpret_cast<const char*>(&length),4);output.write(record.data(),length);}output.flush();if(!output){output.close();std::filesystem::remove(temp,error);throw std::runtime_error("Could not write the restore file.");}}
  if(!MoveFileExW(temp.c_str(),target.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)){std::filesystem::remove(temp,error);throw std::runtime_error("Could not replace the restore file.");}buffer.dirty=false;
 }
 template<class Failure>void flushAll(Failure fail){for(const auto& [id,buffer]:buffers)if(buffer.dirty)try{flush(id);}catch(const std::exception& e){fail(id,e.what());}}
};
}
