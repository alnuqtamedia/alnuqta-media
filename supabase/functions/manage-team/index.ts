import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = new Set([
  'https://alnuqtamedia.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

function responseHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  return {
    ...(allowedOrigins.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
}

function accessTokenAal(authHeader: string) {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const encoded = token.split('.')[1]
    if (!encoded) return ''
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return String(JSON.parse(atob(padded)).aal || '')
  } catch {
    return ''
  }
}

Deno.serve(async (req) => {
  const corsHeaders = responseHeaders(req)
  const origin = req.headers.get('origin') || ''
  if (origin && !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ ok: false, error: 'Origin not allowed.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization') || ''

    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userError } = await caller.auth.getUser()
    if (userError || !user) throw new Error('غير مصرح.')

    const admin = createClient(url, service)
    const body = await req.json()
    const action = String(body.action || 'create')
    const targetId = String(body.user_id || '')
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    const newsroomRoles = ['owner','editor','writer','designer','photographer','videographer']
    if (!profile || !newsroomRoles.includes(profile.role)) throw new Error('غير مصرح.')

    if (action === 'directory') {
      const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (authError) throw authError
      const activeIds = (authData.users || [])
        .filter((u) => !u.banned_until || new Date(u.banned_until).getTime() <= Date.now())
        .map((u) => u.id)
      if (!activeIds.length) {
        return new Response(JSON.stringify({ ok: true, members: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data, error } = await admin.from('profiles').select('id,full_name,role').in('id', activeIds)
      if (error) throw error
      const members = (data || []).filter((member) => newsroomRoles.includes(member.role))
      return new Response(JSON.stringify({ ok: true, members }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (profile.role !== 'owner') throw new Error('هذه العملية متاحة للـOwner فقط.')

    // getUser() above verifies the bearer token with Supabase Auth. Only after
    // that verification do we trust its AAL claim for privileged team actions.
    if (accessTokenAal(authHeader) !== 'aal2') {
      return new Response(JSON.stringify({
        ok: false,
        code: 'mfa_required',
        error: 'تتطلب إدارة الفريق التحقق بالمصادقة الثنائية.',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'list') {
      const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (authError) throw authError
      const ids = (authData.users || []).map((u) => u.id)
      let profiles = []
      if (ids.length) {
        const result = await admin.from('profiles').select('id,full_name,role').in('id', ids)
        if (result.error) throw result.error
        profiles = result.data || []
      }
      const byId = new Map(profiles.map((p) => [p.id, p]))
      const members = (authData.users || []).map((u) => {
        const p = byId.get(u.id)
        return { id: u.id, email: u.email || '', full_name: p?.full_name || u.user_metadata?.full_name || '', role: p?.role || '', active: !u.banned_until || new Date(u.banned_until).getTime() <= Date.now(), has_profile: Boolean(p) }
      })
      return new Response(JSON.stringify({ ok: true, members }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (action === 'role') {
      const nextRole = String(body.role || '')
      if (!targetId || !['owner','editor','writer','designer','photographer','videographer'].includes(nextRole)) throw new Error('بيانات تعديل الدور غير صالحة.')
      if (targetId === user.id && nextRole !== 'owner') throw new Error('لا يمكن خفض صلاحية حساب الـOwner المستخدم حاليًا.')
      const { error } = await admin.from('profiles').update({ role: nextRole }).eq('id', targetId)
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (action === 'disable' || action === 'enable') {
      if (!targetId) throw new Error('معرّف العضو مطلوب.')
      if (targetId === user.id) throw new Error('لا يمكن تعطيل حساب الـOwner المستخدم حاليًا.')
      const { error } = await admin.auth.admin.updateUserById(targetId, {
        ban_duration: action === 'disable' ? '876000h' : 'none'
      })
      if (error) throw error
      return new Response(JSON.stringify({ ok: true, action }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const fullName = String(body.full_name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')
    const role = String(body.role || 'writer')
    if (!fullName || !email || password.length < 12) throw new Error('الاسم والإيميل وكلمة مرور من 12 حرفاً على الأقل مطلوبة.')
    if (!['owner','editor','writer','designer','photographer','videographer'].includes(role)) throw new Error('الدور غير صالح.')

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName }
    })
    if (createError) throw createError

    const { error: profileError } = await admin.from('profiles').upsert({
      id: created.user.id, full_name: fullName, role
    })
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id)
      throw profileError
    }

    return new Response(JSON.stringify({ ok: true, user: { id: created.user.id, email, full_name: fullName, role } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error?.message || String(error) }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
