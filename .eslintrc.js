module.exports = {
	'env': {
		'browser': true,
		'commonjs': true,
		'es2021': true,
	},
	'extends': [
		'google',
	],
	'parserOptions': {
		'ecmaVersion': 'latest',
	},
	'rules': {
		'indent': [ 'error', 'tab' ],
		'max-len': [ 'error', { 'code': 170 } ],
		'no-tabs': [ 'error', { 'allowIndentationTabs': true } ],
		'object-curly-spacing': [ 'error', 'always' ],
		'block-spacing': [ 'error', 'always' ],
		'array-bracket-spacing': [ 'error', 'always' ],
		'require-jsdoc': [ 'error', {
			'require': {
				'FunctionDeclaration': false,
				'MethodDefinition': false,
				'ClassDeclaration': false,
				'ArrowFunctionExpression': false,
				'FunctionExpression': false,
			},
		} ],
	},
};
