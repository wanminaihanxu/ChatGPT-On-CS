import axios from 'axios';

const UMAMI_API_ENDPOINT = 'https://anl.wizgadg.top/api/send';
const SITE_ID = 'eb4d2b94-6054-454d-8369-d4f443f75a99';

interface EventData {
  [key: string]: string | number | undefined;
}

// Send event function
export function sendEvent(
  event_name: string,
  title: string,
  event_data: { [key: string]: string | number | undefined } = {},
): void {
  // 仅在开发环境下打印日志
  if (process.env.NODE_ENV === 'development') {
    console.log('Analytics event:', { event_name, title, event_data });
  }
}

// Predefined event: Button click
export function trackButtonClick(buttonName: string): void {
  sendEvent('button_click', window.location.href, {
    button_name: buttonName,
  });
}

// Predefined event: Checkbox change
export function trackCheckboxChange(
  checkboxName: string,
  value: string[],
): void {
  sendEvent('checkbox_change', window.location.href, {
    value: `${checkboxName}_${value.join(',')}`,
  });
}

// Predefined event: Page view
export function trackPageView(pageName: string): void {
  sendEvent('page_view', window.location.href, {
    page_name: pageName,
  });
}
