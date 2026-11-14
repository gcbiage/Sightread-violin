// Google Analytics is optional in this fork: it only loads when VITE_PUBLIC_GA_ID is set.
export const GA_TRACKING_ID: string = import.meta.env.VITE_PUBLIC_GA_ID ?? ''

function isEnabled(): boolean {
  return import.meta.env.PROD && !!GA_TRACKING_ID && typeof window.gtag === 'function'
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url: string) => {
  if (!isEnabled()) {
    return
  }
  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  })
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const event = ({ action, category, label, value }: any) => {
  if (!isEnabled()) {
    return
  }
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  })
}
