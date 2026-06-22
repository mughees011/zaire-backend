const { dpapiEncrypt, dpapiDecrypt } = require('./services/system_config_service.js');
console.log("Encrypted:", dpapiEncrypt('test_key_123'));
