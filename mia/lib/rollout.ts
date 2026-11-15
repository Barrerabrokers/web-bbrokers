type RolloutConfig = {
  MIA_NEW_ENGINE_ENABLED?: string;
  MIA_TEST_NUMBERS?: string;
  MIA_TEST_EMAILS?: string;
};

function argentinePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (/^549\d{10}$/.test(digits)) return digits.slice(3);
  if (/^54\d{10}$/.test(digits)) return digits.slice(2);
  return digits;
}

function list(value: string | undefined, normalize: (value: string) => string) {
  return (value ?? '').split(',').map(value => normalize(value.trim())).filter(Boolean);
}

export function newMiaEngineAllows(phone: string, email: string, config: RolloutConfig) {
  if (config.MIA_NEW_ENGINE_ENABLED?.trim().toLowerCase() === 'true') return true;
  return list(config.MIA_TEST_NUMBERS, argentinePhone).includes(argentinePhone(phone)) &&
    list(config.MIA_TEST_EMAILS, value => value.toLowerCase()).includes(email.trim().toLowerCase());
}
