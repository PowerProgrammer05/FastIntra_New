import { NextResponse } from 'next/server';
import {
  buildRemoteHeaders,
  fetchRemoteJson,
  formBody,
  getSetCookieLines,
  mergeCookieHeader
} from '../../../../lib/hh-client';
import { getSessionById, getSessionIdFromRequest, updateSession } from '../../../../lib/session-store';

const CLASSROOM_REFERER = 'https://hh.hana.hs.kr/main/classroom/apply.do';
const ROOM_PAGE_SIZE = 50;
const MAX_ROOM_PAGES = 20;

function getRoomKey(item) {
  return [
    item.cr_idx || '',
    item.slp_idx || '',
    item.slp_code || '',
    item.slp_nm || ''
  ].join(':');
}

export async function GET(request) {
  const sessionId = getSessionIdFromRequest(request);
  const session = await getSessionById(sessionId);

  if (!session?.remoteCookieHeader) {
    return NextResponse.json({ result: 'fail', resMsg: '로그인이 필요합니다.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const slgNum = String(url.searchParams.get('slgNum') || '').trim();
  const stIdxFull = String(url.searchParams.get('stIdxFull') || '').trim();

  if (!slgNum) {
    return NextResponse.json({ result: 'fail', resMsg: '동 정보를 선택해 주세요.' }, { status: 400 });
  }

  let cookieHeader = session.remoteCookieHeader;
  let lastResponseData = {};
  const rawRooms = [];
  const seenKeys = new Set();

  for (let cp = 1; cp <= MAX_ROOM_PAGES; cp += 1) {
    const { response, json } = await fetchRemoteJson('/main/classroom/cls-cr-list.json', {
      method: 'POST',
      headers: buildRemoteHeaders({
        cookieHeader,
        referer: CLASSROOM_REFERER,
        origin: 'https://hh.hana.hs.kr',
        contentType: 'application/x-www-form-urlencoded'
      }),
      body: formBody({
        cp,
        pageSize: ROOM_PAGE_SIZE,
        listType: 'list',
        stIdxFull,
        slgNum,
        schClassYn: 'Y'
      })
    });

    lastResponseData = json || {};
    cookieHeader = mergeCookieHeader(cookieHeader, getSetCookieLines(response.headers));

    if (lastResponseData.result !== 'success') {
      return NextResponse.json(
        { result: 'fail', resMsg: lastResponseData.resMsg || '교과교실 목록을 가져오지 못했습니다.' },
        { status: response.status || 200 }
      );
    }

    const pageRooms = Array.isArray(lastResponseData.list) ? lastResponseData.list : [];
    let addedCount = 0;

    pageRooms.forEach((item) => {
      const key = getRoomKey(item);
      if (seenKeys.has(key)) return;

      seenKeys.add(key);
      rawRooms.push(item);
      addedCount += 1;
    });

    const returnedPageSize = Number(lastResponseData.classRoomSearchVo?.pageSize || ROOM_PAGE_SIZE);
    if (pageRooms.length === 0 || addedCount === 0 || pageRooms.length < returnedPageSize) {
      break;
    }
  }

  if (cookieHeader !== session.remoteCookieHeader) {
    await updateSession(sessionId, { remoteCookieHeader: cookieHeader });
  }

  const rooms = rawRooms
    .map((item) => ({
      crIdx: Number(item.cr_idx || 0),
      slpIdx: Number(item.slp_idx || 0),
      slgNum: String(item.slg_num || slgNum),
      buildingName: item.slg_nm || '',
      roomCode: item.slp_code || '',
      roomName: item.slp_nm || '',
      useYn: item.cr_use_yn || '',
      approvalName: item.ca_cd_name || '',
      teacherApprovalName: item.at_cd_name || '',
      crtIdx: Number(item.crt_idx || item.crtIdx || 0),
      myYn: item.myYn || item.my_yn || '',
      requestStatusCode: item.cc_cd || '',
      requestStatusName: item.cc_cd_name || '',
      classRange: item.cr_class || '',
      stIdx: Number(item.st_idx || 0),
      stName: item.st_nm || '',
      stTime: item.st_time || '',
      edTime: item.ed_time || '',
      scheduleGroup: item.stg_nm || '',
      scheduleDescription: item.stg_cont || '',
      selectable: item.cr_use_yn === 'Y' && !!item.cr_idx,
      stIdxFull,
      remote: item
    }));

  return NextResponse.json({
    result: 'success',
    rooms,
    list: rawRooms,
    slgNum,
    stIdxFull,
    totalRawCount: rawRooms.length,
    resMsg: lastResponseData.resMsg || ''
  });
}
