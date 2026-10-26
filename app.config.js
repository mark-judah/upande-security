// The development build (eas.json "development" profile sets APP_VARIANT)
// installs as its own app beside the preview/production one, so a test
// phone keeps the guards' app - and any patrol points it still holds -
// untouched. Firebase is left out of it: google-services.json is registered
// for com.upande.security only, so push notifications do not work in the
// development build. Every other profile gets app.json unchanged.
module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'development') return config;
  const android = { ...config.android, package: 'com.upande.security.dev' };
  delete android.googleServicesFile;
  return { ...config, name: `${config.name} DEV`, android };
};
