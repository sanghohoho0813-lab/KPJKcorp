import sys, json, time
sys.path.insert(0, sys.argv[1])
from faster_whisper import WhisperModel
t0 = time.time()
m = WhisperModel('turbo', device='cpu', compute_type='int8', cpu_threads=4, download_root=sys.argv[1] + '/../hf')
segs, info = m.transcribe(sys.argv[2], language='ko', beam_size=5, word_timestamps=True,
    vad_filter=True, vad_parameters={'min_silence_duration_ms': 300}, condition_on_previous_text=False,
    initial_prompt=sys.argv[4])
out = []
for s in segs:
    out.append({'start': s.start, 'end': s.end, 'text': s.text, 'words': [{'s': w.start, 'e': w.end, 'w': w.word} for w in s.words]})
json.dump(out, open(sys.argv[3], 'w'), ensure_ascii=False)
print('took', round(time.time() - t0), 's', len(out), 'segments')
