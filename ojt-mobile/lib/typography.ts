import React from 'react';
import { Platform } from 'react-native';

export const APP_FONT = Platform.select({
  ios: 'Times New Roman',
  android: 'serif',
  default: 'Times New Roman',
});

// Polyfill jsx-runtime and React.createElement so all Text and TextInput components render with Times New Roman
try {
  const jsxRuntime = require('react/jsx-runtime');
  const origJsx = jsxRuntime.jsx;
  const origJsxs = jsxRuntime.jsxs;

  function patchProps(type: any, props: any) {
    if (!props) return props;
    const typeName = (type?.displayName || type?.name || type || '').toString().toLowerCase();
    if (
      typeName.includes('text') ||
      typeName.includes('input') ||
      typeName.includes('title') ||
      typeName.includes('label')
    ) {
      const existingStyle = props.style;
      const fontStyle = { fontFamily: APP_FONT };
      return {
        ...props,
        style: Array.isArray(existingStyle)
          ? [fontStyle, ...existingStyle]
          : existingStyle
          ? [fontStyle, existingStyle]
          : fontStyle,
      };
    }
    return props;
  }

  if (origJsx) {
    jsxRuntime.jsx = function (type: any, props: any, key: any) {
      return origJsx.call(jsxRuntime, type, patchProps(type, props), key);
    };
  }
  if (origJsxs) {
    jsxRuntime.jsxs = function (type: any, props: any, key: any) {
      return origJsxs.call(jsxRuntime, type, patchProps(type, props), key);
    };
  }

  const origCreate = React.createElement;
  if (origCreate) {
    React.createElement = function (type: any, props: any, ...children: any[]) {
      return origCreate.call(React, type, patchProps(type, props), ...children);
    };
  }
} catch (e) {
  console.debug('Typography patch skipped:', e);
}
