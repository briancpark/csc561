module.exports = {
    'env': {
        'browser': true,
        'es2021': true,
    },
    'extends': 'google',
    'overrides': [
        {
            'env': {
                'node': true,
            },
            'files': [
                '.eslintrc.{js,cjs}',
            ],
            'parserOptions': {
                'sourceType': 'script',
            },
        },
    ],
    'parserOptions': {
        'ecmaVersion': 'latest',
        'sourceType': 'module',
    },
    'ignorePatterns': ['gl-matrix-min.js'],
    'rules': {
        'indent': ['error', 4],
    },
};
