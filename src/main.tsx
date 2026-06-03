import * as React from 'react';
import { createRoot } from 'react-dom/client';

import App from './app/App';
import './styles/index.css';
import ErrorBoundary from './app/components/ErrorBoundary';

// Instrumentation: detect invalid `style` props (string instead of object)
try {
	const origCreateElement = React.createElement;
	// @ts-ignore
	React.createElement = function (type: any, props: any, ...children: any[]) {
		try {
			if (props && props.style && typeof props.style === 'string') {
				console.error('Invalid style prop (string) detected on element:', {
					element: type && (type.displayName || type.name || String(type)),
					style: props.style,
					props,
				});
			}
		} catch (e) {
			// ignore instrumentation errors
		}
		return origCreateElement.apply(this, [type, props, ...children]);
	} as any;
} catch (e) {
	// ignore if React API is unavailable
}

createRoot(document.getElementById('root')!).render(
	<ErrorBoundary>
		<App />
	</ErrorBoundary>
);
