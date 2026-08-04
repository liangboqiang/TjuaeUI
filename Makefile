
cat-config:
	@base64 -D -i ~/.tjuaeui-config-dev/tjuaeui-config.txt | python3 -c 'import sys, urllib.parse; print(urllib.parse.unquote(sys.stdin.read()))' | pbcopy
