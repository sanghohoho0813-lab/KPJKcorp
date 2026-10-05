# verify.sh file.mp4 — 길이·규격·음량·끝 무음
f=$1
${FFMPEG:-ffmpeg} -hide_banner -i "$f" 2>&1 | grep -E "Duration|Stream" | sed 's/^ *//'
${FFMPEG:-ffmpeg} -hide_banner -nostats -i "$f" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2
${FFMPEG:-ffmpeg} -hide_banner -nostats -sseof -2 -i "$f" -af volumedetect -f null - 2>&1 | grep max_volume
