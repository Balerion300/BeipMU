"""Exercise the compiled Windows application against isolated local fixtures."""
import http.server, socketserver, threading, socket, struct, zlib, pathlib, subprocess, json, time
ROOT=pathlib.Path(__file__).resolve().parents[1]

def png():
    width,height=320,160
    rows=b''.join(b'\0'+b''.join(bytes((40+x//3,60+y//2,100+(x+y)//4)) for x in range(width)) for y in range(height))
    def chunk(name,data):return struct.pack('!I',len(data))+name+data+struct.pack('!I',zlib.crc32(name+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(rows))+chunk(b'IEND',b'')
class Images(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith(('/fixture.png','/render?')):
            data=png();self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
        else:self.send_error(404)
    def log_message(self,*args):pass

http=http.server.ThreadingHTTPServer(('127.0.0.1',0),Images)
threading.Thread(target=http.serve_forever,daemon=True).start()
image_base=f'http://127.0.0.1:{http.server_port}/'
exe=ROOT/'dist/BeipMU-Recovery-0.12/BeipMU-Recovery.exe'
assert exe.exists(), 'Build first.'
results={}
for protocol in ['pueblo','mxp']:
    listener=socket.socket();listener.bind(('127.0.0.1',0));listener.listen(1);listener.settimeout(25)
    port=listener.getsockname()[1];received=bytearray();failure=[]
    def serve():
        try:
            conn,_=listener.accept()
            with conn:
                conn.settimeout(15)
                if protocol=='pueblo':
                    conn.sendall(b'This world is Pueblo 1.10 enhanced.\r\n')
                    while b'PUEBLOCLIENT 2.01\r\n' not in received:received.extend(conn.recv(4096))
                    content=f'''</xch_mudtext><pre>BeipMU recovery: Pueblo fixture\r\n\x1b[38;2;126;192;181mHall — 🐉\x1b[0m\r\n<a xch_cmd="look fixture" xch_hint="Inspect the room">Inspect the room</a> · <a href="https://www.westeros.org/">Westeros</a>\r\n<a xch_cmd="look artwork"><img src="{image_base}fixture.png" height="160" alt="Clickable room image"></a>\r\n<img src="{image_base}render?id=1&amp;size=320" alt="Image URL with a query string">\r\n<img src="{image_base}missing.png" alt="Missing image">\r\nFIXTURE COMPLETE\r\n'''
                else:
                    conn.sendall(b'\xff\xfb\x5b')
                    while b'\xff\xfd\x5b' not in received:received.extend(conn.recv(4096))
                    conn.sendall(b'\xff\xfa\x5b\xff\xf0')
                    content=f'''\x1b[6zBeipMU recovery: MXP fixture\r\n<send href="look fixture|inventory" hint="Room actions|Inspect|Inventory">Inspect the room</send>\r\n<image url="{image_base}" fname="fixture.png" height="160" alt="MXP room image">\r\n<img src="{image_base}render?id=1&amp;size=320" alt="MXP query image">\r\n<img src="{image_base}missing.png" alt="Missing image">\r\nFIXTURE COMPLETE\r\n'''
                if protocol=='pueblo':
                    # Public BoD login uses SAMP and BR+LF outside PRE. Both must
                    # not create display breaks. Explicit repeated BR keeps a blank row.
                    login = '<SAMP>PUEBLO SPACING START<br>\nUse create &lt;name&gt; &lt;password&gt; to create a visitor account.<br>\nUse connect Guest Guest to connect to a guest account.<br>\nUse connect &lt;name&gt; &lt;password&gt; to connect to your existing account.<br>\n<br>\nUse who to find out who is online currently.<br>\nPUEBLO SPACING END<br>\n</SAMP>'
                    content=content.replace('</xch_mudtext><pre>', '</xch_mudtext>'+login+'<pre>')
                    content=content.replace('FIXTURE COMPLETE','WHO START<BR>\r\nName        On for<BR>\r\nAlice       01:00<BR>\r\nBob         02:00<BR>\r\nWHO END<BR>\r\nFIXTURE COMPLETE')
                content=content.replace('FIXTURE COMPLETE',f'Plain image URL: {image_base}fixture.png?raw=1\r\nFIXTURE COMPLETE')
                payload=content.encode()
                # Split tags, ANSI controls, entities and multibyte Unicode on wire.
                for i in range(0,len(payload),7):conn.sendall(payload[i:i+7]);time.sleep(.002)
                deadline=time.monotonic()+5
                while b'look fixture\r\n' not in received and time.monotonic()<deadline:
                    data=conn.recv(4096)
                    if not data:break
                    received.extend(data)
                time.sleep(3)
        except Exception as e:failure.append(str(e)+'; received='+repr(bytes(received)))
        finally:listener.close()
    thread=threading.Thread(target=serve,daemon=True);thread.start()
    out=ROOT/'test-results'/protocol;out.mkdir(parents=True,exist_ok=True)
    for filename in ['result.json','preview.png','timeout.txt','trace.txt','wire.json']:
        (out/filename).unlink(missing_ok=True)
    si=subprocess.STARTUPINFO();si.dwFlags|=subprocess.STARTF_USESHOWWINDOW;si.wShowWindow=4
    app=subprocess.Popen([str(exe),'--test',str(port),str(out)],startupinfo=si)
    try:app.wait(timeout=30)
    except subprocess.TimeoutExpired:app.kill();app.wait();raise AssertionError('Application test timed out')
    thread.join(timeout=6)
    assert not failure,failure
    assert (out/'result.json').exists(),f'No WebView test result in {out}'
    result=json.loads((out/'result.json').read_text(encoding='utf-8'))
    if protocol=='pueblo':
        login_start=result['lines'].index('PUEBLO SPACING START');login_end=result['lines'].index('PUEBLO SPACING END')
        assert result['lines'][login_start:login_end+1]==['PUEBLO SPACING START','Use create <name> <password> to create a visitor account.','Use connect Guest Guest to connect to a guest account.','Use connect <name> <password> to connect to your existing account.','','Use who to find out who is online currently.','PUEBLO SPACING END'],result['lines']
        start=result['lines'].index('WHO START');end=result['lines'].index('WHO END')
        assert result['lines'][start:end+1]==['WHO START','Name        On for','Alice       01:00','Bob         02:00','WHO END'],result['lines']
    assert result['images']==4,result
    assert result['loaded']==3 and result['failed']==1,result
    assert result['commandClicked'] and b'look fixture\r\n' in received,result
    assert ('Pueblo' if protocol=='pueblo' else 'MXP') in result['protocol'],result
    assert (out/'preview.png').stat().st_size>1000,'No screenshot'
    (out/'wire.json').write_text(json.dumps({'received_hex':received.hex(),'received_text':received.decode(errors='replace')},indent=2))
    results[protocol]=result
    print(f'{protocol}: three inline images rendered, one failed image reported, command click received.')
http.shutdown()
(ROOT/'test-results/summary.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
