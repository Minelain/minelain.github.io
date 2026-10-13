import sys, subprocess, time, gzip, json
from playwright.sync_api import sync_playwright
root, port = sys.argv[1], sys.argv[2]
srv = subprocess.Popen(['python3','-m','http.server',port,'--directory',root],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
pages=['index.html','news.html','donate.html','wiki/index.html','wiki/po-igre/nacii.html']
JS="""() => new Promise(res => {
  const o={fcp:0,lcp:0,cls:0,tbt:0};
  new PerformanceObserver(l=>{for(const e of l.getEntries()) if(e.name==='first-contentful-paint') o.fcp=e.startTime}).observe({type:'paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries()) o.lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries()) if(!e.hadRecentInput) o.cls+=e.value}).observe({type:'layout-shift',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries()) o.tbt+=Math.max(0,e.duration-50)}).observe({type:'longtask',buffered:true});
  setTimeout(()=>{o.nodes=document.getElementsByTagName('*').length; res(o)},3000);
})"""
try:
  with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox'])
    for pg_ in pages:
        runs=[]
        for i in range(3):
            ctx=b.new_context(viewport={'width':1440,'height':900})
            pg=ctx.new_page(); cdp=ctx.new_cdp_session(pg)
            cdp.send('Network.enable'); cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':80,'downloadThroughput':1.6*1024*1024/8*8/8,'uploadThroughput':750*1024/8})
            cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
            reqs=[]
            def h(r):
                if r.url.startswith('http://localhost'):
                    reqs.append(r)
                else: pass
            pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://localhost') else r.abort())
            pg.on('requestfinished',h)
            pg.goto(f'http://localhost:{port}/{pg_}',wait_until='load')
            m=pg.evaluate(JS)
            tot=0;raw=0;css=js=img=font=0
            for r in reqs:
                try: body=r.response().body()
                except Exception: continue
                raw+=len(body); g=len(gzip.compress(body,6)) if r.resource_type in('document','stylesheet','script') else len(body); tot+=g
                if r.resource_type=='stylesheet': css+=g
                if r.resource_type=='script': js+=g
                if r.resource_type=='image': img+=g
                if r.resource_type=='font': font+=g
            m.update(req=len(reqs),kb=tot/1024,css=css/1024,js=js/1024,img=img/1024,font=font/1024)
            runs.append(m); ctx.close()
        runs.sort(key=lambda m:m['lcp']); m=runs[1]
        print(f"{pg_:26s} req={m['req']:2d} total={m['kb']:6.0f}KB css={m['css']:5.1f} js={m['js']:5.1f} img={m['img']:5.0f} font={m['font']:3.0f} nodes={m['nodes']:4d} FCP={m['fcp']:5.0f}ms LCP={m['lcp']:5.0f}ms CLS={m['cls']:.3f} TBT={m['tbt']:4.0f}ms")
    b.close()
finally: srv.terminate()
