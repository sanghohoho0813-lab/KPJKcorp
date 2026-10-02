import sys, json, time
sys.path.insert(0, sys.argv[1])
from faster_whisper import WhisperModel
t0=time.time()
m = WhisperModel('turbo', device='cpu', compute_type='int8', cpu_threads=4, download_root=sys.argv[1]+'/hf')
segs, info = m.transcribe(sys.argv[2], language='ko', word_timestamps=True, vad_filter=False, beam_size=5,
  initial_prompt='KPJK 경영컨설팅, 재무제표, 법인등기부등본, 주주명부, 고객 Portal, AX, 기업부설연구소, 정책자금, 고용지원금.')
out=[]
for s in segs:
    out.append({'start':s.start,'end':s.end,'text':s.text,'words':[{'s':w.start,'e':w.end,'w':w.word} for w in s.words]})
    print(f"{s.start:7.2f} {s.end:7.2f} {s.text}", flush=True)
json.dump(out, open(sys.argv[3],'w'), ensure_ascii=False)
print('took', time.time()-t0)
