import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service.js';

export type SubscriptionMatch = {
    id: number;
    address: string | null;
    rooms: number | null;
    areaTotal: number | null;
    priceUsd: number | null;
    priceByn: number | null;
    priceEur: number | null;
    districtName: string | null;
    metroStation: string | null;
    metroTime: number | null;
    photos: string[];
    trigger: 'new' | 'price-down';
};

type Currency = 'USD' | 'BYN' | 'EUR';

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', BYN: 'Br', EUR: '€' };

type SendDigestParams = {
    to: string;
    userName: string | null;
    subscriptionId: string;
    subscriptionName: string;
    filtersSummary: string;
    matches: SubscriptionMatch[];
    displayCurrency: Currency;
};

@Injectable()
export class SubscriptionMailer {
    private readonly frontendUrl: string;

    constructor(
        private readonly mail: MailService,
        private readonly config: ConfigService,
    ) {
        this.frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    }

    async sendDigest(p: SendDigestParams): Promise<void> {
        const subject = this.buildSubject(p);
        const html = this.buildHtml(p);
        await this.mail.send({ to: p.to, subject, html });
    }

    private buildSubject({ matches, subscriptionName }: SendDigestParams): string {
        const n = matches.length;
        const newN = matches.filter(m => m.trigger === 'new').length;
        const dropN = matches.filter(m => m.trigger === 'price-down').length;
        if (newN && dropN) return `${n} обновлений по подписке «${subscriptionName}»`;
        if (dropN) return `Цены снизились: ${dropN} по подписке «${subscriptionName}»`;
        return `Новых объявлений: ${newN} по подписке «${subscriptionName}»`;
    }

    private buildHtml(p: SendDigestParams): string {
        const items = p.matches.map(m => this.renderCard(m, p.displayCurrency)).join('');
        const greeting = p.userName ? `Здравствуйте, ${escapeHtml(p.userName)}!` : 'Здравствуйте!';
        const subscriptionUrl = `${this.frontendUrl}/subscriptions`;
        return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f7f7f8;color:#1f2937;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:24px 28px 16px 28px;border-bottom:1px solid #e5e7eb;">
      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">RealtX · подписка</div>
      <div style="font-size:18px;font-weight:600;color:#111827;">${escapeHtml(p.subscriptionName)}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:2px;">${escapeHtml(p.filtersSummary)}</div>
    </td></tr>
    <tr><td style="padding:20px 28px 8px 28px;">
      <div style="font-size:15px;color:#374151;">${greeting} По вашей подписке нашлись новые совпадения:</div>
    </td></tr>
    <tr><td style="padding:0 28px 24px 28px;">
      ${items}
    </td></tr>
    <tr><td style="padding:16px 28px 24px 28px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;">
      <a href="${subscriptionUrl}" style="color:#2563eb;text-decoration:none;">Управлять подписками</a>
      · Не хотите получать письма? Отключите канал Email в настройках подписки.
    </td></tr>
  </table>
</body></html>`;
    }

    private renderCard(m: SubscriptionMatch, currency: Currency): string {
        const priceRaw = currency === 'USD' ? m.priceUsd : currency === 'BYN' ? m.priceByn : m.priceEur;
        const price = priceRaw !== null
            ? `${priceRaw.toLocaleString('ru-RU')} ${CURRENCY_SYMBOL[currency]}`
            : '—';
        const title = [
            m.rooms ? `${m.rooms}-комн.` : 'Квартира',
            m.areaTotal ? `${m.areaTotal} м²` : null,
        ].filter(Boolean).join(', ');
        const meta = [
            m.districtName,
            m.metroStation ? `м. ${m.metroStation}${m.metroTime ? ` · ${m.metroTime} мин` : ''}` : null,
        ].filter(Boolean).join(' · ');
        const badge = m.trigger === 'price-down'
            ? `<span style="display:inline-block;background:#dcfce7;color:#166534;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;margin-left:8px;">снижена цена</span>`
            : `<span style="display:inline-block;background:#dbeafe;color:#1e40af;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;margin-left:8px;">новое</span>`;
        const link = `${this.frontendUrl}/property/${m.id}`;
        const photo = m.photos[0];
        const photoCell = photo
            ? `<td width="120" style="padding:0;vertical-align:top;"><a href="${link}"><img src="${escapeHtml(photo)}" width="120" height="90" alt="" style="display:block;border-radius:6px;object-fit:cover;" /></a></td>`
            : '';

        return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      <tr>
        ${photoCell}
        <td style="padding:12px 14px;vertical-align:top;">
          <div style="font-size:15px;font-weight:600;color:#111827;">
            <a href="${link}" style="color:#111827;text-decoration:none;">${escapeHtml(title)}</a>${badge}
          </div>
          <div style="font-size:13px;color:#6b7280;margin-top:2px;">${escapeHtml(m.address ?? '')}</div>
          ${meta ? `<div style="font-size:12px;color:#9ca3af;margin-top:2px;">${escapeHtml(meta)}</div>` : ''}
          <div style="font-size:16px;font-weight:700;color:#111827;margin-top:8px;">${price}</div>
        </td>
      </tr>
    </table>`;
    }
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[c]!));
}
