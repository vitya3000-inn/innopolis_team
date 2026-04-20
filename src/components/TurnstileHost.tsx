import React from 'react';

type Props = {
  siteKey: string;
  onVerify: (token: string) => void;
};

/** На нативных платформах виджет не показывается; проверка — через политику на backend (см. BOT_CHECK_DISABLED). */
export default function TurnstileHost(_props: Props) {
  return null;
}
