'use strict';
// Shared fixtures and original assertions live in the first entry; importing it
// does not execute its VM contracts or its independent conversion group.
const { runOfficeConversionGroup } = require('./office-ops-conversion.e2e.js');
runOfficeConversionGroup('recovery').catch(error => {
  console.error('FAIL', error && error.stack || error);
  process.exitCode = 1;
});
