test:
	./node_modules/istanbul/lib/cli.js cover ./node_modules/mocha/bin/_mocha --report lcovonly -- -R spec

local_test:
	./node_modules/.bin/mocha --reporter spec

.PHONY: test
