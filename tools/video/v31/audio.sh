set -e
FF=${FFMPEG:-ffmpeg}
cd "$1"
$FF -y -loglevel error -i "$2" -af "atempo=1.13" -ac 1 -ar 48000 sped.wav
python3 ../tighten.py
$FF -i tight.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' > ln.json
MI=$(python3 -c "import json;j=json.load(open('ln.json'));print(f\"measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}\")")
$FF -y -loglevel error -i tight.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11:$MI:linear=true,aresample=48000" -ac 2 voice_pre.wav
$FF -i voice_pre.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:|Peak:" | tail -2
