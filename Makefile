default:
	@make install

install:
	@docker run --rm -v `pwd`:/opt/app:cached -w /opt/app/ -t node:18 npm install

build:
	@docker run --rm -v `pwd`:/opt/app:cached -w /opt/app/ -t node:18 npm run build

dev:
	@docker run --rm -v `pwd`:/opt/app:cached -w /opt/app/ -p 5173:5173 -it node:18 npm run dev -- --host=0.0.0.0

.PHONY: install build dev