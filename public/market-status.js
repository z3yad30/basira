function getCairoDate() {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Cairo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(new Date()).filter((part) => part.type !== 'literal');
    const lookup = {};
    parts.forEach((part) => {
      lookup[part.type] = part.value;
    });

    return new Date(`${lookup.year}-${lookup.month}-${lookup.day}T${lookup.hour}:${lookup.minute}:${lookup.second}`);
  } catch (error) {
    return new Date();
  }
}

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDayName(dayIndex) {
  const names = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  return names[dayIndex] || '';
}

function getNextTradingDay(currentDay) {
  if (currentDay === 4) return 0; // Thursday → Sunday
  if (currentDay === 5) return 0; // Friday → Sunday
  if (currentDay === 6) return 0; // Saturday → Sunday
  return currentDay + 1;
}

function getMarketStatus() {
  const now = getCairoDate();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentMinutes = hour * 60 + minute;
  const openMinutes = 10 * 60;
  const closeMinutes = 14 * 60 + 30;
  const isTradingDay = day >= 0 && day <= 4;
  const timeLabel = formatTime(now);

  if (!isTradingDay) {
    const nextDay = getNextTradingDay(day);
    const title = 'البورصة مغلقة اليوم (عطلة رسمية).';
    const detail = `تفتح ${getDayName(nextDay)} عند 10:00 بتوقيت القاهرة. الساعة الآن ${timeLabel}.`;
    return { status: 'holiday', title, detail, isOpen: false };
  }

  if (currentMinutes < openMinutes) {
    const title = 'البورصة مغلقة الآن.';
    const detail = `ستفتح اليوم عند 10:00 بتوقيت القاهرة. الساعة الآن ${timeLabel}.`;
    return { status: 'closed', title, detail, isOpen: false };
  }

  if (currentMinutes >= closeMinutes) {
    const nextDay = getNextTradingDay(day);
    const title = 'انتهى تداول اليوم.';
    const detail = `تفتح ${getDayName(nextDay)} عند 10:00 بتوقيت القاهرة. الساعة الآن ${timeLabel}.`;
    return { status: 'closed', title, detail, isOpen: false };
  }

  const title = 'البورصة مفتوحة الآن.';
  const detail = `تتداول من 10:00 حتى 14:30 بتوقيت القاهرة. الساعة الآن ${timeLabel}.`;
  return { status: 'open', title, detail, isOpen: true };
}

function renderMarketStatus() {
  const container = document.getElementById('marketStatusBanner');
  if (!container) return;

  const { status, title, detail } = getMarketStatus();
  const icon = status === 'open' ? '⚡' : status === 'holiday' ? '🏛️' : '⛔';

  container.classList.remove('open', 'closed', 'holiday');
  container.classList.add(status);
  container.innerHTML = `
    <span class="status-icon">${icon}</span>
    <div class="status-content">
      <span class="status-title">${title}</span>
      <span class="status-detail">${detail}</span>
    </div>
  `.trim();
}

function initMarketStatus() {
  renderMarketStatus();
  const container = document.getElementById('marketStatusBanner');
  if (!container) return;
  setInterval(renderMarketStatus, 60 * 1000);
}

document.addEventListener('DOMContentLoaded', initMarketStatus);
