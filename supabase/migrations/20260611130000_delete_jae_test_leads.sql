-- Delete the "Jae Test" pipeline-debug leads that landed in Divigner via
-- /refer/jae during today's email template work. Scoped to the exact prospect
-- email + RA referral source so legitimate Divigner leads stay untouched.

DELETE FROM public.leads
 WHERE organization_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
   AND lead_source     = 'ra_referral'
   AND email           = 'jae@divigner.com';
