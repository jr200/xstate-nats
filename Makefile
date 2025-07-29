all: install check build run

build: install
	pnpm run build

run:
	pnpm run dev

update:
	pnpm update --latest

check:
	pnpm run prettier --write
	pnpm run lint

clean:
	rm -rf node_modules/
	rm -rf dist/
	rm -rf examples/react-test/node_modules/
	rm -f examples/react-test/pnpm-lock.yaml
	rm -f pnpm-lock.yaml
	find ./src -name "*.d.ts" -delete

install:
	pnpm install

start-nats-test-server:
	nats-server -c nats-server.conf -n vitest-xstate-nats &
	sleep 2

stop-nats-test-server:
	kill `cat /tmp/nats-xstate-nats-test.pid` || true
	rm -f /tmp/nats-xstate-nats-test.pid


example-react-test: build
	cd examples/react-test && pnpm install && pnpm run dev
