#pragma once
#include <functional>
#include <algorithm>
// Owned, independent WebViews. Panels receive semantic snapshots, never the main bridge.
struct FloatingWindow : std::enable_shared_from_this<FloatingWindow> {
 HWND hwnd=nullptr,ownerWindow=nullptr; std::string id,snapshot; bool ready=false,moving=false,moveCanceled=false; double ownerZoom=1.0;
 ComPtr<ICoreWebView2Controller> controller; ComPtr<ICoreWebView2> view;
 std::function<void(const std::string&)> notify;
 std::function<double()> zoomFactor;
 void drag(const char* phase){
  if(!ownerWindow||!IsWindow(ownerWindow))return;POINT point{};if(!GetCursorPos(&point)||!ScreenToClient(ownerWindow,&point))return;
  const double zoom=zoomFactor?zoomFactor():ownerZoom;const double scale=double(GetDpiForWindow(ownerWindow))/96.0*(zoom>0?zoom:1.0);
  notify("float:drag|"+id+"|"+phase+"|"+std::to_string(double(point.x)/scale)+"|"+std::to_string(double(point.y)/scale)+"|"+((GetKeyState(VK_CONTROL)&0x8000)?"1":"0"));
 }
 static LRESULT CALLBACK proc(HWND h,UINT m,WPARAM w,LPARAM l){
  auto p=reinterpret_cast<FloatingWindow*>(GetWindowLongPtrW(h,GWLP_USERDATA));
  if(m==WM_NCCREATE){p=static_cast<FloatingWindow*>(reinterpret_cast<CREATESTRUCTW*>(l)->lpCreateParams);p->hwnd=h;SetWindowLongPtrW(h,GWLP_USERDATA,reinterpret_cast<LONG_PTR>(p));}
  if(p){if(m==WM_SIZE){if(p->controller){RECT r{};GetClientRect(h,&r);p->controller->put_Bounds(r);}return 0;}
   if(m==WM_ENTERSIZEMOVE){p->moving=false;p->moveCanceled=false;}
   if(m==WM_MOVING){p->moving=true;p->drag("move");}
   if(m==WM_CANCELMODE||(m==WM_KEYDOWN&&w==VK_ESCAPE)){p->moveCanceled=true;if(p->moving)p->drag("cancel");}
   if(m==WM_EXITSIZEMOVE){RECT r{};GetWindowRect(h,&r);p->notify("float:bounds|"+p->id+"|"+std::to_string(r.left)+"|"+std::to_string(r.top)+"|"+std::to_string(r.right-r.left)+"|"+std::to_string(r.bottom-r.top));if(p->moving)p->drag(p->moveCanceled||(GetAsyncKeyState(VK_ESCAPE)&0x8000)?"cancel":"drop");p->moving=false;}
   if(m==WM_DESTROY){p->hwnd=nullptr;if(p->controller)p->controller->Close();p->view.Reset();p->controller.Reset();p->notify(std::string(p->ready?"float:closed|":"float:error|")+p->id);return 0;}}
  return DefWindowProcW(h,m,w,l);
 }
 void update(std::string data){snapshot=std::move(data);if(ready&&view)view->PostWebMessageAsString(wide("float:snapshot|"+snapshot).c_str());}
 bool open(HWND owner,ICoreWebView2Environment* env,const std::filesystem::path& ui,const std::string& title,int x,int y,int width,int height){
  ownerWindow=owner;
  WNDCLASSW c{};c.lpfnWndProc=proc;c.hInstance=GetModuleHandleW(nullptr);c.lpszClassName=L"BeipMURecoveryFloating";c.hCursor=LoadCursorW(nullptr,IDC_ARROW);RegisterClassW(&c);
  x=std::clamp(x,GetSystemMetrics(SM_XVIRTUALSCREEN),GetSystemMetrics(SM_XVIRTUALSCREEN)+std::max(0,GetSystemMetrics(SM_CXVIRTUALSCREEN)-width));
  y=std::clamp(y,GetSystemMetrics(SM_YVIRTUALSCREEN),GetSystemMetrics(SM_YVIRTUALSCREEN)+std::max(0,GetSystemMetrics(SM_CYVIRTUALSCREEN)-height));
  hwnd=CreateWindowExW(0,c.lpszClassName,wide(title).c_str(),WS_OVERLAPPEDWINDOW,x,y,width,height,owner,nullptr,c.hInstance,this);if(!hwnd)return false;
  auto self=shared_from_this();
  HRESULT hr=env->CreateCoreWebView2Controller(hwnd,Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([self,ui](HRESULT hr,ICoreWebView2Controller* control){
   if(!self->hwnd)return S_OK;
   if(FAILED(hr)||!control){PostMessageW(self->hwnd,WM_CLOSE,0,0);return S_OK;}
   self->controller=control;control->get_CoreWebView2(&self->view);RECT r{};GetClientRect(self->hwnd,&r);control->put_Bounds(r);
   ComPtr<ICoreWebView2_3> mapping;if(FAILED(self->view.As(&mapping))||FAILED(mapping->SetVirtualHostNameToFolderMapping(L"beipmu-preview.local",ui.c_str(),COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_DENY_CORS))){PostMessageW(self->hwnd,WM_CLOSE,0,0);return S_OK;}
   ComPtr<ICoreWebView2Settings> settings;self->view->get_Settings(&settings);settings->put_AreDefaultScriptDialogsEnabled(FALSE);settings->put_AreDevToolsEnabled(FALSE);settings->put_IsStatusBarEnabled(FALSE);
   EventRegistrationToken token;
   self->view->add_NavigationStarting(Callback<ICoreWebView2NavigationStartingEventHandler>([](ICoreWebView2*,ICoreWebView2NavigationStartingEventArgs* a){LPWSTR uri=nullptr;a->get_Uri(&uri);bool ok=uri&&std::wstring(uri)==L"https://beipmu-preview.local/panel.html";CoTaskMemFree(uri);if(!ok)a->put_Cancel(TRUE);return S_OK;}).Get(),&token);
   self->view->add_NewWindowRequested(Callback<ICoreWebView2NewWindowRequestedEventHandler>([](ICoreWebView2*,ICoreWebView2NewWindowRequestedEventArgs* a){a->put_Handled(TRUE);return S_OK;}).Get(),&token);
   self->view->add_PermissionRequested(Callback<ICoreWebView2PermissionRequestedEventHandler>([](ICoreWebView2*,ICoreWebView2PermissionRequestedEventArgs* a){a->put_State(COREWEBVIEW2_PERMISSION_STATE_DENY);return S_OK;}).Get(),&token);
   self->view->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>([self](ICoreWebView2*,ICoreWebView2WebMessageReceivedEventArgs* a){LPWSTR source=nullptr;a->get_Source(&source);bool trusted=source&&std::wstring(source)==L"https://beipmu-preview.local/panel.html";CoTaskMemFree(source);LPWSTR value=nullptr;
    if(trusted&&SUCCEEDED(a->TryGetWebMessageAsString(&value))){std::string text=utf8(value);CoTaskMemFree(value);if(text=="float:ready"){self->ready=true;self->update(self->snapshot);self->notify("float:ready|"+self->id);}else if(text.starts_with("float:event|")){std::string decoded;if(unbase64(text.substr(12),decoded,65536)&&validUtf8(decoded))self->notify("float:event|"+self->id+"|"+text.substr(12));}}return S_OK;}).Get(),&token);
   self->view->Navigate(L"https://beipmu-preview.local/panel.html");return S_OK;
  }).Get());
  if(FAILED(hr)){DestroyWindow(hwnd);return false;}ShowWindow(hwnd,SW_SHOW);return true;
 }
};


