'use strict';

const PROBE = `
local fingerprint = ARGV[1]
local k = tonumber(ARGV[2])
local hmac = ARGV[3 + k]
local reserve = tonumber(ARGV[4 + k])
local pendingTtl = tonumber(ARGV[5 + k])
local nowMs = tonumber(ARGV[6 + k])

local marker = redis.call('GET', KEYS[1])
if not marker then return {-1, 0} end
if marker ~= fingerprint then return {-2, 0} end

local present = 1
for i = 3, 2 + k do
  if redis.call('GETBIT', KEYS[2], ARGV[i]) == 0 then
    present = 0
    break
  end
end

if present == 0 then
  local score = redis.call('ZSCORE', KEYS[3], hmac)
  if score then
    local age = nowMs - tonumber(score)
    if age < pendingTtl then present = 2 end
  end
end

if present == 0 and reserve == 1 then
  for i = 3, 2 + k do
    redis.call('SETBIT', KEYS[2], ARGV[i], 1)
  end
  redis.call('ZADD', KEYS[3], nowMs, hmac)
  return {0, 1}
end

return {present, 0}
`;

const INSERT = `
local k = tonumber(ARGV[1])
local hmac = ARGV[2 + k]
for i = 2, 1 + k do
  redis.call('SETBIT', KEYS[1], ARGV[i], 1)
end
if hmac ~= '' then
  redis.call('ZREM', KEYS[2], hmac)
end
return 1
`;

const MARK_PENDING = `
local nowMs = tonumber(ARGV[#KEYS + 1])
for i = 1, #KEYS do
  redis.call('ZADD', KEYS[i], nowMs, ARGV[i])
end
return #KEYS
`;

const INSERT_BATCH = `
local k = tonumber(ARGV[1])
local count = tonumber(ARGV[2])
local idx = 3
for n = 1, count do
  for j = 1, k do
    redis.call('SETBIT', KEYS[1], ARGV[idx], 1)
    idx = idx + 1
  end
end
return count
`;

const PREALLOCATE = `
redis.call('SETRANGE', KEYS[1], ARGV[1], '\0')
return redis.call('STRLEN', KEYS[1])
`;

const COUNT_BITS = `
return redis.call('BITCOUNT', KEYS[1])
`;

const SET_READY = `
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[2])
return 1
`;

const SET_ACTIVE_VERSION = `
redis.call('SET', KEYS[1], ARGV[1])
return 1
`;

const CLEAR_OLD_PENDING = `
return redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
`;

const COUNT_PENDING = `
return redis.call('ZCARD', KEYS[1])
`;

const PROBE_BITS = `
local k = tonumber(ARGV[1])
for i = 2, 1 + k do
  if redis.call('GETBIT', KEYS[1], ARGV[i]) == 0 then return 0 end
end
return 1
`;

module.exports = {
    PROBE,
    INSERT,
    MARK_PENDING,
    INSERT_BATCH,
    PREALLOCATE,
    COUNT_BITS,
    SET_READY,
    SET_ACTIVE_VERSION,
    CLEAR_OLD_PENDING,
    COUNT_PENDING,
    PROBE_BITS
};
