module.exports = {
  default: {
    paths: ['features/**/*.feature'],
    import: ['tests/step_definitions/**/*.ts'],
    format: ['progress-bar', 'summary'],
    publishQuiet: true
  }
};