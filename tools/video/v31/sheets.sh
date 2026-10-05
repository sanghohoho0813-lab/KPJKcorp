# sheets.sh dir — fr/*.png 를 16장씩 묶어 sheet1..n.png
D=$1; cd $D; rm -f fr/*.png sheet*.png
GUIDE=1 node ../frames.mjs $D/comp.html $D/fr $(cat ts.txt)
n=0; ls $D/fr/*.png | sort | xargs -n 16 | while read -r line; do n=$((n+1)); node ../sheet.mjs $D/sheet$n.png 270 8 $line; done
ls $D/sheet*.png
