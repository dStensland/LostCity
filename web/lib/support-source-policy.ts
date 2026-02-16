export type SupportTrackKey =
  | "public_health"
  | "food_support"
  | "mental_health"
  | "community_wellness"
  | "substance_recovery"
  | "disability_services"
  | "pediatric_family"
  | "transportation"
  | "immigrant_refugee"
  | "dental_vision"
  | "housing_homelessness"
  | "chronic_disease"
  | "crisis_safety"
  | "veterans"
  | "legal_aid"
  | "employment_workforce"
  | "financial_assistance"
  | "senior_services"
  | "adult_education"
  | "neurological"
  | "cancer_support"
  | "autoimmune"
  | "respiratory"
  | "musculoskeletal"
  | "blood_disorders"
  | "sensory"
  | "womens_health"
  | "transplant"
  | "pediatric_health"
  | "patient_financial"
  | "hospital_community";

export type SupportSourcePolicyItem = {
  id: string;
  name: string;
  track: SupportTrackKey;
  focus: string;
  url: string;
};

export const SUPPORT_SOURCE_POLICY_ITEMS: SupportSourcePolicyItem[] = [
  // ── public_health ──
  {
    id: "cdc",
    name: "CDC",
    track: "public_health",
    focus: "Public health prevention and community guidance",
    url: "https://www.cdc.gov/",
  },
  {
    id: "ga-dph",
    name: "Georgia DPH",
    track: "public_health",
    focus: "State-level public health resources and services",
    url: "https://dph.georgia.gov/",
  },
  {
    id: "fulton-board-health",
    name: "Fulton County Board of Health",
    track: "public_health",
    focus: "Local clinic and outreach schedules",
    url: "https://fultoncountyboh.com/",
  },
  {
    id: "dekalb-public-health",
    name: "DeKalb Public Health",
    track: "public_health",
    focus: "County public health events and resources",
    url: "https://dekalbpublichealth.com/",
  },
  {
    id: "good-samaritan-health-center",
    name: "Good Samaritan Health Center of Atlanta",
    track: "public_health",
    focus: "Free clinic, vaccine drives, health fairs, and mobile clinics",
    url: "https://goodsamatlanta.org/",
  },
  {
    id: "northside-health-fairs",
    name: "Northside Hospital Community Health Fairs",
    track: "public_health",
    focus: "Free community health screenings and health education",
    url: "https://www.northside.com/",
  },
  {
    id: "red-cross-cpr-atlanta",
    name: "American Red Cross CPR & First Aid Training",
    track: "public_health",
    focus: "CPR certification, First Aid classes, and disaster preparedness workshops",
    url: "https://www.redcross.org/local/georgia.html",
  },

  // ── food_support ──
  {
    id: "atlanta-community-food-bank",
    name: "Atlanta Community Food Bank",
    track: "food_support",
    focus: "Food support and pantry access",
    url: "https://www.acfb.org/find-food/",
  },
  {
    id: "open-hand-atlanta",
    name: "Open Hand Atlanta",
    track: "food_support",
    focus: "Nutrition and meal support for families",
    url: "https://openhandatlanta.org/",
  },
  {
    id: "red-cross-blood",
    name: "American Red Cross Blood Drives",
    track: "food_support",
    focus: "Blood drives and emergency support",
    url: "https://www.redcross.org/local/georgia.html",
  },
  {
    id: "food-well-alliance",
    name: "Food Well Alliance",
    track: "food_support",
    focus: "Urban agriculture, produce access, and neighborhood food resilience",
    url: "https://www.foodwellalliance.org/",
  },
  {
    id: "georgia-organics",
    name: "Georgia Organics",
    track: "food_support",
    focus: "Nutrition education, food systems learning, and local farm support",
    url: "https://georgiaorganics.org/",
  },
  {
    id: "giving-kitchen",
    name: "Giving Kitchen",
    track: "food_support",
    focus: "Emergency food-service worker support and meal-adjacent relief",
    url: "https://thegivingkitchen.org/",
  },
  {
    id: "united-way-atlanta",
    name: "United Way of Greater Atlanta",
    track: "food_support",
    focus: "Family support navigation and coordinated care resources",
    url: "https://unitedwayatlanta.org/",
  },
  {
    id: "meals-on-wheels-atlanta",
    name: "Meals on Wheels Atlanta",
    track: "food_support",
    focus: "Home-delivered meals and food support for vulnerable residents",
    url: "https://mealsonwheelsatlanta.org/",
  },
  {
    id: "community-farmers-markets",
    name: "Community Farmers Markets",
    track: "food_support",
    focus: "Fresh local food access through weekly neighborhood farmers markets",
    url: "https://cfmatl.org/",
  },
  {
    id: "concrete-jungle",
    name: "Concrete Jungle",
    track: "food_support",
    focus: "Fruit gleaning volunteer events and food bank donations",
    url: "https://concrete-jungle.org/",
  },
  {
    id: "hosea-helps",
    name: "Hosea Helps",
    track: "food_support",
    focus: "Hunger and homelessness relief, food distribution events",
    url: "https://hoseahelps.org/",
  },

  // ── mental_health ──
  {
    id: "nami-georgia",
    name: "NAMI Georgia",
    track: "mental_health",
    focus: "Mental health education, peer support, and caregiver resources",
    url: "https://namiga.org/",
  },
  {
    id: "mha-georgia",
    name: "Mental Health America of Georgia",
    track: "mental_health",
    focus: "Community mental wellness workshops and advocacy programs",
    url: "https://mhageorgia.org/",
  },
  {
    id: "aid-atlanta",
    name: "AID Atlanta",
    track: "mental_health",
    focus: "Community testing, prevention, and HIV support services",
    url: "https://www.aidatlanta.org/",
  },
  {
    id: "dbsa-atlanta",
    name: "DBSA Metropolitan Atlanta",
    track: "mental_health",
    focus: "Depression and bipolar support groups across metro Atlanta",
    url: "https://atlantamoodsupport.org/",
  },
  {
    id: "skyland-trail",
    name: "Skyland Trail",
    track: "mental_health",
    focus: "Mental health lectures, education workshops, and community events",
    url: "https://www.skylandtrail.org/",
  },
  {
    id: "ridgeview-institute",
    name: "Ridgeview Institute",
    track: "mental_health",
    focus: "Weekly mental health and addiction recovery support groups",
    url: "https://www.ridgeviewsmyrna.com/",
  },
  {
    id: "chris-180",
    name: "Chris 180",
    track: "mental_health",
    focus: "Trauma-informed care for children, youth, and families in crisis",
    url: "https://chris180.org/",
  },
  {
    id: "griefshare-atlanta",
    name: "GriefShare Atlanta",
    track: "mental_health",
    focus: "Grief support groups across metro Atlanta churches",
    url: "https://www.griefshare.org/",
  },
  {
    id: "divorcecare-atlanta",
    name: "DivorceCare Atlanta",
    track: "mental_health",
    focus: "Divorce recovery support groups across metro Atlanta",
    url: "https://www.divorcecare.org/",
  },
  {
    id: "kates-club",
    name: "Kate's Club",
    track: "mental_health",
    focus: "Grief support for children and teens who have lost a parent or sibling",
    url: "https://www.katesclub.org/",
  },
  {
    id: "positive-impact-health",
    name: "Positive Impact Health Centers",
    track: "mental_health",
    focus: "HIV/STI testing, behavioral health, and PrEP enrollment events",
    url: "https://www.positiveimpacthealthcenters.org/",
  },
  {
    id: "sisterlove",
    name: "SisterLove",
    track: "mental_health",
    focus: "Reproductive justice, mobile HIV testing, and community health education",
    url: "https://www.sisterlove.org/",
  },
  {
    id: "naesm",
    name: "NAESM",
    track: "mental_health",
    focus: "Black gay and bisexual men's health, free STI testing, and peer support",
    url: "https://naesminc.org/",
  },

  // ── community_wellness ──
  {
    id: "ymca-atlanta",
    name: "YMCA of Metro Atlanta",
    track: "community_wellness",
    focus: "Family wellness and movement classes",
    url: "https://www.ymcaatlanta.org/",
  },
  {
    id: "hands-on-atlanta",
    name: "Hands On Atlanta",
    track: "community_wellness",
    focus: "Volunteer-led neighborhood support, food access, and civic care",
    url: "https://www.handsonatlanta.org/",
  },
  {
    id: "dekalb-library",
    name: "DeKalb County Public Library",
    track: "community_wellness",
    focus: "Free public workshops, family programming, and care-adjacent education",
    url: "https://dekalblibrary.org/",
  },
  {
    id: "park-pride",
    name: "Park Pride",
    track: "community_wellness",
    focus: "Community-led park activations and neighborhood wellness events",
    url: "https://parkpride.org/",
  },
  {
    id: "beltline-fitness",
    name: "Atlanta BeltLine Fitness",
    track: "community_wellness",
    focus: "Free neighborhood movement classes and run/walk programming",
    url: "https://beltline.org/things-to-do/fitness/",
  },
  {
    id: "health-walks-atlanta",
    name: "Atlanta Health Walks & Charity Runs",
    track: "community_wellness",
    focus: "Walk-based fundraising and community fitness for public health causes",
    url: "https://www.heart.org/en/affiliates/georgia/atlanta",
  },
  {
    id: "medshare",
    name: "MedShare",
    track: "community_wellness",
    focus: "Medical supply sorting volunteer sessions and global health fundraisers",
    url: "https://www.medshare.org/",
  },
  {
    id: "empowerline",
    name: "Empowerline",
    track: "community_wellness",
    focus: "Aging and disability services, caregiver support, and senior wellness",
    url: "https://empowerline.org/",
  },
  {
    id: "grady-health",
    name: "Grady Health Foundation",
    track: "community_wellness",
    focus: "Health equity events, support programs, and community outreach",
    url: "https://www.gradyhealthfoundation.org/",
  },
  {
    id: "alzheimers-association-georgia",
    name: "Alzheimer's Association Georgia",
    track: "community_wellness",
    focus: "Caregiver education, dementia support groups, and advocacy events",
    url: "https://www.alz.org/georgia",
  },
  {
    id: "city-of-refuge",
    name: "City of Refuge Atlanta",
    track: "community_wellness",
    focus: "Job training, food distribution, after-school programs, and community services",
    url: "https://cityofrefugeatl.org/",
  },
  {
    id: "urban-league-atlanta",
    name: "Urban League of Greater Atlanta",
    track: "community_wellness",
    focus: "Education, workforce development, and civil rights advocacy events",
    url: "https://ulgatl.org/",
  },
  {
    id: "faith-alliance",
    name: "Faith Alliance of Metro Atlanta",
    track: "community_wellness",
    focus: "Interfaith community service and social justice events",
    url: "https://faithallianceofmetroatlanta.org/",
  },
  {
    id: "aarp-georgia",
    name: "AARP Georgia",
    track: "community_wellness",
    focus: "Free workshops, community activities, and senior advocacy events",
    url: "https://local.aarp.org/atlanta-ga/",
  },
  {
    id: "bgc-atlanta",
    name: "Boys & Girls Clubs of Metro Atlanta",
    track: "community_wellness",
    focus: "Youth wellness programs, teen health fairs, and after-school fitness",
    url: "https://bgcma.org/",
  },

  // ── substance_recovery ──
  {
    id: "aa-atlanta",
    name: "Alcoholics Anonymous Atlanta",
    track: "substance_recovery",
    focus: "Daily AA meetings across metro Atlanta for alcohol recovery support",
    url: "https://www.atlantaaa.org/",
  },
  {
    id: "ga-council-recovery",
    name: "Georgia Council on Substance Abuse",
    track: "substance_recovery",
    focus: "Recovery advocacy, peer support, and community recovery events",
    url: "https://www.gasubstanceabuse.org/",
  },
  {
    id: "ga-harm-reduction",
    name: "Georgia Harm Reduction Coalition",
    track: "substance_recovery",
    focus: "Harm reduction services, naloxone training, and community outreach",
    url: "https://www.gaharmreduction.org/",
  },
  {
    id: "metro-atl-aa",
    name: "Metro Atlanta AA",
    track: "substance_recovery",
    focus: "Recovery meetings and support groups across metro Atlanta",
    url: "https://www.atlantaaa.org/",
  },
  {
    id: "na-georgia",
    name: "Narcotics Anonymous Metro Atlanta",
    track: "substance_recovery",
    focus: "500+ weekly NA meetings across metro Atlanta",
    url: "https://www.na.org/",
  },

  // ── disability_services ──
  {
    id: "dsaa",
    name: "Down Syndrome Association of Atlanta",
    track: "disability_services",
    focus: "Family support, education, and community events for Down syndrome",
    url: "https://www.dsaatl.org/",
  },
  {
    id: "spectrum-autism",
    name: "Spectrum Autism Support Group",
    track: "disability_services",
    focus: "Monthly support groups, camps, and autism family resources",
    url: "https://www.spectrumautism.org/",
  },
  {
    id: "blazesports",
    name: "BlazeSports America",
    track: "disability_services",
    focus: "Adaptive sports and Paralympic training programs",
    url: "https://blazesports.org/",
  },
  {
    id: "brain-injury-ga",
    name: "Brain Injury Association of Georgia",
    track: "disability_services",
    focus: "Support groups, conferences, and brain injury recovery resources",
    url: "https://www.biaga.org/",
  },
  {
    id: "shepherd-center",
    name: "Shepherd Center",
    track: "disability_services",
    focus: "Spinal cord and brain injury rehab, support groups, and community programs",
    url: "https://www.shepherd.org/",
  },

  // ── pediatric_family ──
  {
    id: "healthy-mothers-ga",
    name: "Healthy Mothers Healthy Babies Coalition of Georgia",
    track: "pediatric_family",
    focus: "Prenatal and postpartum support groups and maternal health",
    url: "https://www.hmhbga.org/",
  },
  {
    id: "cbww",
    name: "Center for Black Women's Wellness",
    track: "pediatric_family",
    focus: "Weekly wellness classes, health education, and community events",
    url: "https://www.cbww.org/",
  },
  {
    id: "cure-childhood-cancer",
    name: "CURE Childhood Cancer",
    track: "pediatric_family",
    focus: "Family support, fundraising events, and childhood cancer resources",
    url: "https://www.curechildhoodcancer.org/",
  },
  {
    id: "planned-parenthood-se",
    name: "Planned Parenthood Southeast",
    track: "pediatric_family",
    focus: "Reproductive health education, community workshops, and sexual health events",
    url: "https://www.plannedparenthood.org/planned-parenthood-southeast",
  },

  // ── transportation ──
  {
    id: "common-courtesy",
    name: "Common Courtesy Inc",
    track: "transportation",
    focus: "Free transportation to medical appointments for underserved patients",
    url: "https://commoncourtesy.org/",
  },

  // ── immigrant_refugee ──
  {
    id: "irc-atlanta",
    name: "International Rescue Committee Atlanta",
    track: "immigrant_refugee",
    focus: "Refugee resettlement, health navigation, and community integration",
    url: "https://www.rescue.org/united-states/atlanta-ga",
  },
  {
    id: "latin-american-assoc",
    name: "Latin American Association",
    track: "immigrant_refugee",
    focus: "Health services, workforce development, and annual health expo",
    url: "https://www.thelaa.org/",
  },
  {
    id: "cpacs",
    name: "Center for Pan Asian Community Services",
    track: "immigrant_refugee",
    focus: "Multilingual health services, senior programs, and cultural events",
    url: "https://www.cpacs.org/",
  },
  {
    id: "advancing-justice-atlanta",
    name: "Asian Americans Advancing Justice - Atlanta",
    track: "immigrant_refugee",
    focus: "Know-your-rights workshops, citizenship drives, and AAPI advocacy",
    url: "https://www.advancingjustice-atlanta.org/",
  },

  // ── dental_vision ──
  {
    id: "ben-massell-dental",
    name: "Ben Massell Dental Clinic",
    track: "dental_vision",
    focus: "Free dental care for low-income uninsured adults",
    url: "https://www.benmasselldentalclinic.org/",
  },
  {
    id: "ga-lions-lighthouse",
    name: "Georgia Lions Lighthouse Foundation",
    track: "dental_vision",
    focus: "Free vision and hearing screenings and eyeglass programs",
    url: "https://www.lionslighthouse.org/",
  },

  // ── housing_homelessness ──
  {
    id: "mercy-care",
    name: "Mercy Care Atlanta",
    track: "housing_homelessness",
    focus: "Healthcare for people experiencing homelessness and community events",
    url: "https://www.mercyatlanta.org/",
  },
  {
    id: "hope-atlanta",
    name: "Hope Atlanta",
    track: "housing_homelessness",
    focus: "Homeless outreach, housing assistance, and community programs",
    url: "https://www.hopeatlanta.org/",
  },
  {
    id: "atlanta-mission",
    name: "Atlanta Mission",
    track: "housing_homelessness",
    focus: "Shelter, recovery programs, and volunteer events for homelessness",
    url: "https://atlantamission.org/",
  },
  {
    id: "lost-n-found-youth",
    name: "Lost-N-Found Youth",
    track: "housing_homelessness",
    focus: "LGBTQ homeless youth services, shelter, and community events",
    url: "https://lnfy.org/",
  },

  // ── chronic_disease ──
  {
    id: "sickle-cell-ga",
    name: "Sickle Cell Foundation of Georgia",
    track: "chronic_disease",
    focus: "Mobile testing, Camp New Hope, and annual awareness walks",
    url: "https://www.sicklecellga.org/",
  },
  {
    id: "lupus-ga",
    name: "Lupus Foundation of America Georgia",
    track: "chronic_disease",
    focus: "Support groups, education, and lupus awareness events",
    url: "https://www.lupus.org/georgia",
  },
  {
    id: "cancer-support-community-atlanta",
    name: "Cancer Support Community Atlanta",
    track: "chronic_disease",
    focus: "100+ free monthly programs: support groups, exercise, nutrition workshops",
    url: "https://www.cscatlanta.org/",
  },
  {
    id: "piedmont-cancer-support",
    name: "Piedmont Cancer Institute Support Groups",
    track: "chronic_disease",
    focus: "Monthly cancer patient and caregiver support groups",
    url: "https://www.piedmontcancerinstitute.com/",
  },
  {
    id: "acs-georgia",
    name: "American Cancer Society Georgia",
    track: "chronic_disease",
    focus: "Cancer screenings, Relay for Life, support groups, and awareness events",
    url: "https://www.cancer.org/about-us/local/georgia.html",
  },
  {
    id: "ada-georgia",
    name: "American Diabetes Association Georgia",
    track: "chronic_disease",
    focus: "Step Out Walk, diabetes prevention programs, and education workshops",
    url: "https://diabetes.org/",
  },
  {
    id: "aha-georgia",
    name: "American Heart Association Georgia",
    track: "chronic_disease",
    focus: "CPR classes, Heart Walk, heart health screenings, and Go Red events",
    url: "https://www.heart.org/en/affiliates/georgia",
  },
  {
    id: "nkf-georgia",
    name: "National Kidney Foundation Georgia",
    track: "chronic_disease",
    focus: "Kidney Walk, screening events, and kidney health support groups",
    url: "https://www.kidney.org/offices/nkf-serving-alabama-georgia-and-mississippi",
  },

  // ── crisis_safety ──
  {
    id: "padv",
    name: "Partnership Against Domestic Violence",
    track: "crisis_safety",
    focus: "Crisis shelters, safety planning workshops, and DV support groups",
    url: "https://padv.org/",
  },
  {
    id: "wrcdv",
    name: "Women's Resource Center to End Domestic Violence",
    track: "crisis_safety",
    focus: "Dating violence prevention workshops, support groups, and community education",
    url: "https://www.wrcdv.org/",
  },

  // ── veterans ──
  {
    id: "va-atlanta",
    name: "VA Atlanta Healthcare System",
    track: "veterans",
    focus: "Health screenings, PTSD support groups, and veteran wellness events",
    url: "https://www.va.gov/atlanta-health-care/",
  },
  {
    id: "vetlanta",
    name: "VETLANTA",
    track: "veterans",
    focus: "Quarterly veteran summits, monthly Shop-Talk sessions, and networking events",
    url: "https://vetlanta.org/",
  },
  {
    id: "warrior-alliance",
    name: "The Warrior Alliance",
    track: "veterans",
    focus: "Veteran resource expos, fitness training, and Impact Awards gala",
    url: "https://thewarrioralliance.org/",
  },
  {
    id: "atlvets",
    name: "ATLVets (Advancing The Line)",
    track: "veterans",
    focus: "Veteran business networking, BATL Biz Summit, and monthly meetups",
    url: "https://atlvets.org/",
  },

  // ── legal_aid ──
  {
    id: "atlanta-legal-aid",
    name: "Atlanta Legal Aid Society",
    track: "legal_aid",
    focus: "Know Your Rights workshops, benefits enrollment, and medical-legal aid",
    url: "https://atlantalegalaid.org/",
  },
  {
    id: "schr",
    name: "Southern Center for Human Rights",
    track: "legal_aid",
    focus: "Civil rights forums, community workshops, and digital security trainings",
    url: "https://www.schr.org/",
  },

  // ── employment_workforce ──
  {
    id: "worksource-atlanta",
    name: "WorkSource Atlanta",
    track: "employment_workforce",
    focus: "Job fairs, career workshops, training info sessions, and youth employment",
    url: "https://www.worksourceatlanta.org/",
  },
  {
    id: "goodwill-north-ga",
    name: "Goodwill of North Georgia",
    track: "employment_workforce",
    focus: "Career training, hiring events, and digital skills workshops",
    url: "https://ging.org/",
  },
  {
    id: "ga-dept-labor",
    name: "Georgia Department of Labor",
    track: "employment_workforce",
    focus: "Job fairs, reentry programs, and career center workshops",
    url: "https://dol.georgia.gov/",
  },

  // ── financial_assistance ──
  {
    id: "facaa",
    name: "Fulton Atlanta Community Action Authority",
    track: "financial_assistance",
    focus: "LIHEAP enrollment, financial literacy workshops, and rent assistance",
    url: "https://www.facaa.org/",
  },
  {
    id: "salvation-army-atl",
    name: "Salvation Army Metro Atlanta",
    track: "financial_assistance",
    focus: "Emergency financial assistance, holiday programs, and community events",
    url: "https://southernusa.salvationarmy.org/metro-atlanta/",
  },
  {
    id: "st-vincent-de-paul-ga",
    name: "St. Vincent de Paul Georgia",
    track: "financial_assistance",
    focus: "Rent and utility assistance, food pantry, and furniture distribution",
    url: "https://svdpgeorgia.org/",
  },

  // ── senior_services ──
  {
    id: "fulton-senior-services",
    name: "Fulton County Senior Services",
    track: "senior_services",
    focus: "Senior center activities, Medicare wellness days, and health screenings",
    url: "https://www.fultoncountyga.gov/",
  },
  {
    id: "respite-care-atlanta",
    name: "Respite Care Atlanta",
    track: "senior_services",
    focus: "Caregiver support groups, respite day programs, and volunteer training",
    url: "https://www.respitecareatlanta.org/",
  },

  // ── adult_education ──
  {
    id: "aps-adult-education",
    name: "Atlanta Public Schools Adult Education",
    track: "adult_education",
    focus: "Free GED prep, ESL classes, and career readiness workshops",
    url: "https://www.atlantapublicschools.us/",
  },
  {
    id: "literacy-action",
    name: "Literacy Action",
    track: "adult_education",
    focus: "Adult literacy tutoring, ESL, digital literacy, and family literacy events",
    url: "https://literacyaction.org/",
  },

  // ── neurological ──
  {
    id: "marcus-autism-center",
    name: "Marcus Autism Center",
    track: "neurological",
    focus: "Autism research, family workshops, and Emory-affiliated community programs",
    url: "https://www.marcus.org/",
  },
  {
    id: "hdsa-georgia",
    name: "Huntington's Disease Society Georgia",
    track: "neurological",
    focus: "Support groups, Team Hope walks, and caregiver education",
    url: "https://hdsa.org/",
  },
  {
    id: "apda-georgia",
    name: "American Parkinson Disease Association Georgia",
    track: "neurological",
    focus: "Exercise programs, support groups, and caregiver workshops",
    url: "https://www.apdaparkinson.org/",
  },
  {
    id: "epilepsy-foundation-georgia",
    name: "Epilepsy Foundation of Georgia",
    track: "neurological",
    focus: "Seizure first aid training, Camp Peachtree, and support groups",
    url: "https://www.epilepsyfoundation.org/",
  },
  {
    id: "ms-society-georgia",
    name: "National MS Society Georgia",
    track: "neurological",
    focus: "Walk MS events, support groups, and wellness programs",
    url: "https://www.nationalmssociety.org/",
  },
  {
    id: "als-united-georgia",
    name: "ALS United of Georgia",
    track: "neurological",
    focus: "Walk to Defeat ALS, support groups, and equipment loan programs",
    url: "https://alsunitedga.org/",
  },
  {
    id: "lewy-body-dementia",
    name: "Lewy Body Dementia Association",
    track: "neurological",
    focus: "Virtual caregiver support groups and educational webinars",
    url: "https://www.lbda.org/",
  },
  {
    id: "mg-georgia",
    name: "Myasthenia Gravis Georgia",
    track: "neurological",
    focus: "MG Walk events, patient support, and awareness campaigns",
    url: "https://myasthenia.org/",
  },
  {
    id: "tics-georgia",
    name: "Tourette Information Center Georgia",
    track: "neurological",
    focus: "Youth camps, support groups, and Tourette awareness education",
    url: "https://tourette.org/",
  },
  {
    id: "chadd-atlanta",
    name: "CHADD Atlanta",
    track: "neurological",
    focus: "ADHD parent support, educator training, and expert speaker events",
    url: "https://chadd.org/",
  },
  {
    id: "ocd-georgia",
    name: "OCD Georgia",
    track: "neurological",
    focus: "OCD support groups, therapist directory, and awareness walks",
    url: "https://iocdf.org/",
  },

  // ── cancer_support ──
  {
    id: "winship-cancer-institute",
    name: "Winship Cancer Institute",
    track: "cancer_support",
    focus: "Emory NCI-designated cancer center community events and support groups",
    url: "https://winshipcancer.emory.edu/",
  },
  {
    id: "lls-georgia",
    name: "Leukemia & Lymphoma Society Georgia",
    track: "cancer_support",
    focus: "Light The Night walks, Man/Woman of the Year, and patient education",
    url: "https://www.lls.org/",
  },
  {
    id: "komen-atlanta",
    name: "Susan G. Komen Greater Atlanta",
    track: "cancer_support",
    focus: "Race for the Cure, breast health education, and screening events",
    url: "https://www.komen.org/",
  },
  {
    id: "pancan-atlanta",
    name: "Pancreatic Cancer Action Network Atlanta",
    track: "cancer_support",
    focus: "PurpleStride walks, survivor support, and research fundraising",
    url: "https://www.pancan.org/",
  },
  {
    id: "zero-prostate-atlanta",
    name: "ZERO Prostate Cancer Atlanta",
    track: "cancer_support",
    focus: "Run/walk events, screening awareness, and support groups",
    url: "https://zerocancer.org/",
  },
  {
    id: "georgia-ovarian-cancer",
    name: "Georgia Ovarian Cancer Alliance",
    track: "cancer_support",
    focus: "Awareness walks, survivor support groups, and teal ribbon events",
    url: "https://www.gaovariancancer.org/",
  },
  {
    id: "colorectal-cancer-alliance",
    name: "Colorectal Cancer Alliance",
    track: "cancer_support",
    focus: "Screening awareness, Undy Run/Walk, and patient support",
    url: "https://www.ccalliance.org/",
  },
  {
    id: "atlanta-cancer-care-foundation",
    name: "Atlanta Cancer Care Foundation",
    track: "cancer_support",
    focus: "Patient financial assistance, fundraising galas, and community events",
    url: "https://www.atlantacancercarefoundation.org/",
  },
  {
    id: "cancercare",
    name: "CancerCare",
    track: "cancer_support",
    focus: "Free counseling, support groups, financial assistance, and education",
    url: "https://www.cancercare.org/",
  },

  // ── autoimmune ──
  {
    id: "arthritis-foundation-georgia",
    name: "Arthritis Foundation Georgia",
    track: "autoimmune",
    focus: "Jingle Bell Run, Walk to Cure Arthritis, and exercise programs",
    url: "https://www.arthritis.org/",
  },
  {
    id: "crohns-colitis-georgia",
    name: "Crohn's & Colitis Foundation Georgia",
    track: "autoimmune",
    focus: "Take Steps walks, Camp Oasis, and IBD education programs",
    url: "https://www.crohnscolitisfoundation.org/",
  },
  {
    id: "scleroderma-southeast",
    name: "Scleroderma Foundation Southeast",
    track: "autoimmune",
    focus: "Stepping Out to Cure walks, support groups, and patient education",
    url: "https://www.scleroderma.org/",
  },
  {
    id: "sjogrens-atlanta",
    name: "Sjogren's Foundation Atlanta",
    track: "autoimmune",
    focus: "Patient education, support groups, and awareness events",
    url: "https://www.sjogrens.org/",
  },
  {
    id: "psoriasis-foundation-se",
    name: "National Psoriasis Foundation Southeast",
    track: "autoimmune",
    focus: "Team Inspire walks, support groups, and research events",
    url: "https://www.psoriasis.org/",
  },

  // ── respiratory ──
  {
    id: "american-lung-georgia",
    name: "American Lung Association Georgia",
    track: "respiratory",
    focus: "Fight for Air Climb, lung health screenings, and COPD education",
    url: "https://www.lung.org/",
  },
  {
    id: "cff-georgia",
    name: "Cystic Fibrosis Foundation Georgia",
    track: "respiratory",
    focus: "Great Strides walks, CF education, and community fundraising",
    url: "https://www.cff.org/",
  },
  {
    id: "pulmonary-fibrosis-foundation",
    name: "Pulmonary Fibrosis Foundation",
    track: "respiratory",
    focus: "PFF Walk, support groups, and patient education webinars",
    url: "https://www.pulmonaryfibrosis.org/",
  },

  // ── musculoskeletal ──
  {
    id: "mda-georgia",
    name: "Muscular Dystrophy Association Georgia",
    track: "musculoskeletal",
    focus: "MDA Muscle Walk, summer camps, and support groups",
    url: "https://www.mda.org/",
  },
  {
    id: "marfan-foundation-georgia",
    name: "Marfan Foundation Georgia",
    track: "musculoskeletal",
    focus: "Heartfelt Hike, patient conferences, and connective tissue support",
    url: "https://marfan.org/",
  },
  {
    id: "ehlers-danlos-georgia",
    name: "Ehlers-Danlos Society Georgia Network",
    track: "musculoskeletal",
    focus: "EDS awareness events, support groups, and patient networking",
    url: "https://www.ehlers-danlos.com/",
  },

  // ── blood_disorders ──
  {
    id: "hemophilia-of-georgia",
    name: "Hemophilia of Georgia",
    track: "blood_disorders",
    focus: "Camp Wannaklot, family education, and bleeding disorders support",
    url: "https://www.hog.org/",
  },

  // ── sensory ──
  {
    id: "cvi-atlanta",
    name: "Center for the Visually Impaired",
    track: "sensory",
    focus: "Vision rehabilitation, assistive technology, and community events",
    url: "https://www.cviga.org/",
  },
  {
    id: "fighting-blindness-atlanta",
    name: "Foundation Fighting Blindness Atlanta",
    track: "sensory",
    focus: "VisionWalk events, retinal disease education, and research fundraising",
    url: "https://www.fightingblindness.org/",
  },
  {
    id: "gcdhh",
    name: "Georgia Center for the Deaf and Hard of Hearing",
    track: "sensory",
    focus: "Deaf community events, ASL classes, and hearing health resources",
    url: "https://www.gcdhh.org/",
  },

  // ── womens_health ──
  {
    id: "pcos-challenge",
    name: "PCOS Challenge National Association",
    track: "womens_health",
    focus: "PCOS awareness walks, symposiums, and support groups",
    url: "https://pcoschallenge.org/",
  },
  {
    id: "la-leche-league-georgia",
    name: "La Leche League of Georgia",
    track: "womens_health",
    focus: "Breastfeeding support groups and lactation education",
    url: "https://lllusa.org/",
  },
  {
    id: "endometriosis-care-atlanta",
    name: "Center for Endometriosis Care Atlanta",
    track: "womens_health",
    focus: "Endometriosis awareness, patient education, and support events",
    url: "https://centerforendo.com/",
  },
  {
    id: "psi-georgia",
    name: "Postpartum Support International Georgia",
    track: "womens_health",
    focus: "Postpartum depression support groups and maternal mental health",
    url: "https://www.postpartum.net/",
  },

  // ── transplant ──
  {
    id: "donate-life-georgia",
    name: "Donate Life Georgia",
    track: "transplant",
    focus: "Organ donor registration drives and Donate Life awareness events",
    url: "https://donatelifegeorgia.org/",
  },
  {
    id: "georgia-transplant-foundation",
    name: "Georgia Transplant Foundation",
    track: "transplant",
    focus: "Transplant support groups, family assistance, and awareness events",
    url: "https://www.gatransplant.org/",
  },

  // ── pediatric_health ──
  {
    id: "choa-community-events",
    name: "Children's Healthcare of Atlanta",
    track: "pediatric_health",
    focus: "Pediatric health fairs, Strong4Life wellness, and community events",
    url: "https://www.choa.org/",
  },
  {
    id: "camp-twin-lakes",
    name: "Camp Twin Lakes",
    track: "pediatric_health",
    focus: "Year-round camps for children with serious illnesses and disabilities",
    url: "https://www.camptwinlakes.org/",
  },
  {
    id: "camp-sunshine-georgia",
    name: "Camp Sunshine Georgia",
    track: "pediatric_health",
    focus: "Retreats and activities for families affected by childhood cancer",
    url: "https://www.mycampsunshine.com/",
  },
  {
    id: "make-a-wish-georgia",
    name: "Make-A-Wish Georgia",
    track: "pediatric_health",
    focus: "Wish-granting events, Walk For Wishes, and fundraising galas",
    url: "https://wish.org/georgia",
  },
  {
    id: "berts-big-adventure",
    name: "Bert's Big Adventure",
    track: "pediatric_health",
    focus: "Year-round programs for children with chronic and terminal illnesses",
    url: "https://bertsbigadventure.org/",
  },
  {
    id: "best-buddies-georgia",
    name: "Best Buddies Georgia",
    track: "pediatric_health",
    focus: "Friendship programs, Champion of the Year gala, and inclusion events",
    url: "https://www.bestbuddies.org/georgia/",
  },
  {
    id: "march-of-dimes-georgia",
    name: "March of Dimes Georgia",
    track: "pediatric_health",
    focus: "March for Babies walks, prenatal health education, and NICU support",
    url: "https://www.marchofdimes.org/",
  },
  {
    id: "ronald-mcdonald-house-atlanta",
    name: "Ronald McDonald House Charities Atlanta",
    track: "pediatric_health",
    focus: "Family meals, volunteer events, and pediatric family support",
    url: "https://armhc.org/",
  },
  {
    id: "gigis-playhouse-atlanta",
    name: "GiGi's Playhouse Atlanta",
    track: "pediatric_health",
    focus: "Free Down syndrome achievement centers, tutoring, and family events",
    url: "https://gigisplayhouse.org/atlanta/",
  },
  {
    id: "georgia-parent-support-network",
    name: "Georgia Parent Support Network",
    track: "pediatric_health",
    focus: "Family support for children with mental health and behavioral challenges",
    url: "https://gpsn.org/",
  },
  {
    id: "special-olympics-georgia",
    name: "Special Olympics Georgia",
    track: "pediatric_health",
    focus: "Year-round sports, Polar Plunge, and unified champion events",
    url: "https://www.specialolympicsga.org/",
  },

  // ── patient_financial ──
  {
    id: "patient-advocate-foundation",
    name: "Patient Advocate Foundation",
    track: "patient_financial",
    focus: "Insurance navigation, copay relief, and patient case management",
    url: "https://www.patientadvocate.org/",
  },
  {
    id: "healthwell-foundation",
    name: "HealthWell Foundation",
    track: "patient_financial",
    focus: "Prescription copay assistance and underinsured patient support",
    url: "https://www.healthwellfoundation.org/",
  },

  // ── crisis_safety (additional) ──
  {
    id: "afsp-georgia",
    name: "American Foundation for Suicide Prevention Georgia",
    track: "crisis_safety",
    focus: "Out of the Darkness walks, survivor support, and prevention training",
    url: "https://afsp.org/",
  },
  {
    id: "georgia-crisis-line",
    name: "Georgia Crisis & Access Line",
    track: "crisis_safety",
    focus: "24/7 crisis intervention, mobile crisis teams, and behavioral health navigation",
    url: "https://www.mygcal.com/",
  },

  // ── community_wellness (additional) ──
  {
    id: "aids-walk-atlanta",
    name: "AIDS Walk Atlanta & 5K Run",
    track: "community_wellness",
    focus: "Annual fundraising walk for HIV/AIDS services and awareness",
    url: "https://aidswalkatlanta.org/",
  },

  // ── hospital_community ──
  {
    id: "piedmont-healthcare",
    name: "Piedmont Healthcare",
    track: "hospital_community",
    focus: "Community health events, classes, and wellness programs across 20 hospitals",
    url: "https://www.piedmont.org/classes-and-events/classes-and-events",
  },
  {
    id: "piedmonthealthcare-events",
    name: "Piedmont HealthCare Events",
    track: "hospital_community",
    focus: "Hospital community events and public health programming",
    url: "https://www.piedmont.org/",
  },
  {
    id: "piedmont-classes",
    name: "Piedmont Classes",
    track: "hospital_community",
    focus: "CPR, first aid, childbirth education, and wellness classes",
    url: "https://www.piedmont.org/",
  },
  {
    id: "piedmont-heart-conferences",
    name: "Piedmont Heart Conferences",
    track: "hospital_community",
    focus: "Cardiac health education and heart conferences",
    url: "https://www.piedmont.org/",
  },
  {
    id: "piedmont-womens-heart",
    name: "Piedmont Women's Heart Support",
    track: "hospital_community",
    focus: "Women's cardiac health support groups and education",
    url: "https://www.piedmont.org/",
  },
  {
    id: "piedmont-transplant",
    name: "Piedmont Transplant Support",
    track: "hospital_community",
    focus: "Transplant patient and caregiver support programs",
    url: "https://www.piedmont.org/",
  },
  {
    id: "piedmont-fitness",
    name: "Piedmont Fitness Centers",
    track: "hospital_community",
    focus: "Hospital-affiliated fitness programs and wellness activities",
    url: "https://www.piedmont.org/",
  },
  {
    id: "piedmont-foundation",
    name: "Piedmont Foundation Events",
    track: "hospital_community",
    focus: "Hospital foundation fundraisers and community benefit events",
    url: "https://www.piedmont.org/",
  },
  {
    id: "piedmont-auxiliary",
    name: "Piedmont Atlanta Hospital Auxiliary",
    track: "hospital_community",
    focus: "Volunteer events and community service programs",
    url: "https://www.piedmont.org/",
  },
  {
    id: "piedmont-athens",
    name: "Piedmont Athens Spiritual Care",
    track: "hospital_community",
    focus: "Spiritual care, chaplaincy, and patient support services",
    url: "https://www.piedmont.org/",
  },
  {
    id: "piedmont-cme",
    name: "Piedmont CME/CE Portal",
    track: "hospital_community",
    focus: "Continuing medical education and professional development",
    url: "https://www.piedmont.org/",
  },
  {
    id: "wellstar-community-events",
    name: "WellStar Health System Community Events",
    track: "hospital_community",
    focus: "Classes, health screenings, mobile markets, and wellness programs across 13 hospitals",
    url: "https://www.wellstar.org/event-calendar",
  },
  {
    id: "northside-hospital-community",
    name: "Northside Hospital Community Events",
    track: "hospital_community",
    focus: "Maternity classes, cancer support, diabetes groups, and health screenings",
    url: "https://www.northside.com/community-wellness/classes-events",
  },
  {
    id: "adventhealth-georgia",
    name: "AdventHealth Georgia Community Events",
    track: "hospital_community",
    focus: "Health screenings, support groups, nutrition classes, and wellness programs",
    url: "https://www.adventhealth.com/events",
  },
  {
    id: "nghs-community-events",
    name: "Northeast Georgia Health System Community Events",
    track: "hospital_community",
    focus: "Childbirth classes, support groups, diabetes education, and wellness programs",
    url: "https://events.nghs.com",
  },
];

export function getSourcesByTrack(track: SupportTrackKey): SupportSourcePolicyItem[] {
  return SUPPORT_SOURCE_POLICY_ITEMS.filter((item) => item.track === track);
}

const SUPPORT_POLICY_ALIASES: Record<string, string[]> = {
  cdc: ["cdc", "centers for disease control"],
  "ga-dph": ["georgia dph", "georgia department of public health"],
  "fulton-board-health": ["fulton county board of health", "fulton boh"],
  "dekalb-public-health": ["dekalb public health"],
  "good-samaritan-health-center": ["good samaritan health center", "good sam"],
  "northside-health-fairs": ["northside hospital", "northside health fairs"],
  "atlanta-community-food-bank": ["atlanta community food bank", "acfb"],
  "open-hand-atlanta": ["open hand atlanta", "open hand"],
  "red-cross-blood": ["american red cross", "red cross"],
  "food-well-alliance": ["food well alliance"],
  "georgia-organics": ["georgia organics"],
  "giving-kitchen": ["giving kitchen"],
  "united-way-atlanta": ["united way of greater atlanta", "united way atlanta"],
  "meals-on-wheels-atlanta": ["meals on wheels atlanta"],
  "community-farmers-markets": ["community farmers markets", "cfmatl"],
  "concrete-jungle": ["concrete jungle"],
  "hosea-helps": ["hosea helps"],
  "nami-georgia": ["nami georgia", "nami ga"],
  "mha-georgia": ["mental health america of georgia", "mha georgia"],
  "aid-atlanta": ["aid atlanta"],
  "dbsa-atlanta": ["dbsa atlanta", "depression bipolar support"],
  "skyland-trail": ["skyland trail"],
  "ridgeview-institute": ["ridgeview institute"],
  "chris-180": ["chris 180", "chris kids"],
  "griefshare-atlanta": ["griefshare atlanta", "griefshare"],
  "divorcecare-atlanta": ["divorcecare atlanta", "divorcecare"],
  "kates-club": ["kates club", "kate's club"],
  "positive-impact-health": ["positive impact health centers", "positive impact"],
  sisterlove: ["sisterlove", "sister love"],
  naesm: ["naesm"],
  "ymca-atlanta": ["ymca of metro atlanta", "ymca atlanta"],
  "hands-on-atlanta": ["hands on atlanta"],
  "dekalb-library": ["dekalb county public library", "dekalb library"],
  "park-pride": ["park pride"],
  "beltline-fitness": ["atlanta beltline fitness", "beltline fitness"],
  "health-walks-atlanta": ["atlanta health walks", "health walks atlanta"],
  medshare: ["medshare"],
  empowerline: ["empowerline"],
  "grady-health": ["grady health foundation", "grady health"],
  "alzheimers-association-georgia": ["alzheimers association georgia"],
  "city-of-refuge": ["city of refuge"],
  "urban-league-atlanta": ["urban league of greater atlanta", "urban league atlanta"],
  "faith-alliance": ["faith alliance of metro atlanta", "faith alliance"],
  "aarp-georgia": ["aarp georgia", "aarp atlanta"],
  "ga-council-recovery": ["georgia council on substance abuse"],
  "ga-harm-reduction": ["georgia harm reduction coalition"],
  "metro-atl-aa": ["metro atlanta aa"],
  "na-georgia": ["narcotics anonymous metro atlanta", "na georgia"],
  dsaa: ["down syndrome association of atlanta"],
  "spectrum-autism": ["spectrum autism support group"],
  blazesports: ["blazesports america"],
  "brain-injury-ga": ["brain injury association of georgia"],
  "shepherd-center": ["shepherd center"],
  "healthy-mothers-ga": ["healthy mothers healthy babies"],
  cbww: ["center for black women's wellness", "cbww"],
  "cure-childhood-cancer": ["cure childhood cancer"],
  "common-courtesy": ["common courtesy"],
  "irc-atlanta": ["international rescue committee atlanta", "irc atlanta"],
  "latin-american-assoc": ["latin american association"],
  cpacs: ["center for pan asian community services", "cpacs"],
  "advancing-justice-atlanta": ["advancing justice atlanta", "asian americans advancing justice"],
  "ben-massell-dental": ["ben massell dental clinic"],
  "ga-lions-lighthouse": ["georgia lions lighthouse"],
  "mercy-care": ["mercy care atlanta", "mercy care"],
  "hope-atlanta": ["hope atlanta"],
  "atlanta-mission": ["atlanta mission"],
  "lost-n-found-youth": ["lost n found youth", "lnfy"],
  "sickle-cell-ga": ["sickle cell foundation of georgia"],
  "lupus-ga": ["lupus foundation of america georgia"],
  "cancer-support-community-atlanta": ["cancer support community atlanta", "csc atlanta"],
  "piedmont-cancer-support": ["piedmont cancer support", "piedmont cancer institute"],
  "acs-georgia": ["american cancer society georgia", "acs georgia"],
  "ada-georgia": ["american diabetes association georgia", "ada georgia"],
  padv: ["partnership against domestic violence", "padv"],
  "va-atlanta": ["va atlanta", "va atlanta healthcare"],
  "atlanta-legal-aid": ["atlanta legal aid", "atlanta legal aid society"],
  "aha-georgia": ["american heart association georgia", "aha georgia"],
  "nkf-georgia": ["national kidney foundation georgia", "nkf georgia"],
  "red-cross-cpr-atlanta": ["red cross cpr", "red cross first aid", "red cross training"],
  "planned-parenthood-se": ["planned parenthood southeast", "planned parenthood atlanta"],
  "bgc-atlanta": ["boys and girls clubs metro atlanta", "bgc atlanta"],
  wrcdv: ["womens resource center", "wrcdv", "women's resource center to end domestic violence"],
  vetlanta: ["vetlanta"],
  "warrior-alliance": ["warrior alliance", "the warrior alliance"],
  atlvets: ["atlvets", "advancing the line"],
  schr: ["southern center for human rights", "schr"],
  "worksource-atlanta": ["worksource atlanta", "worksource"],
  "goodwill-north-ga": ["goodwill of north georgia", "goodwill north ga"],
  "ga-dept-labor": ["georgia department of labor", "ga dept labor", "gdol"],
  facaa: ["fulton atlanta community action authority", "facaa"],
  "salvation-army-atl": ["salvation army metro atlanta", "salvation army atlanta"],
  "st-vincent-de-paul-ga": ["st vincent de paul georgia", "svdp georgia"],
  "fulton-senior-services": ["fulton county senior services"],
  "respite-care-atlanta": ["respite care atlanta"],
  "aps-adult-education": ["aps adult education", "atlanta public schools adult education"],
  "literacy-action": ["literacy action"],
  // ── neurological ──
  "marcus-autism-center": ["marcus autism center", "marcus center"],
  "hdsa-georgia": ["huntingtons disease society georgia", "hdsa georgia"],
  "apda-georgia": ["american parkinson disease association georgia", "apda georgia"],
  "epilepsy-foundation-georgia": ["epilepsy foundation of georgia", "epilepsy foundation georgia"],
  "ms-society-georgia": ["national ms society georgia", "ms society georgia"],
  "als-united-georgia": ["als united of georgia", "als united georgia"],
  "lewy-body-dementia": ["lewy body dementia association", "lbda"],
  "mg-georgia": ["myasthenia gravis georgia", "mga georgia"],
  "tics-georgia": ["tourette information center georgia", "tourette georgia"],
  "chadd-atlanta": ["chadd atlanta", "chadd"],
  "ocd-georgia": ["ocd georgia", "iocdf georgia"],
  // ── cancer_support ──
  "winship-cancer-institute": ["winship cancer institute", "winship cancer", "emory winship"],
  "lls-georgia": ["leukemia lymphoma society georgia", "lls georgia"],
  "komen-atlanta": ["susan g komen atlanta", "komen atlanta"],
  "pancan-atlanta": ["pancreatic cancer action network atlanta", "pancan atlanta"],
  "zero-prostate-atlanta": ["zero prostate cancer atlanta", "zero prostate atlanta"],
  "georgia-ovarian-cancer": ["georgia ovarian cancer alliance", "goca"],
  "colorectal-cancer-alliance": ["colorectal cancer alliance"],
  "atlanta-cancer-care-foundation": ["atlanta cancer care foundation", "accf"],
  cancercare: ["cancercare"],
  // ── autoimmune ──
  "arthritis-foundation-georgia": ["arthritis foundation georgia"],
  "crohns-colitis-georgia": ["crohns colitis foundation georgia", "ccf georgia"],
  "scleroderma-southeast": ["scleroderma foundation southeast"],
  "sjogrens-atlanta": ["sjogrens foundation atlanta", "sjogrens atlanta"],
  "psoriasis-foundation-se": ["national psoriasis foundation southeast", "npf southeast"],
  // ── respiratory ──
  "american-lung-georgia": ["american lung association georgia", "ala georgia"],
  "cff-georgia": ["cystic fibrosis foundation georgia", "cff georgia"],
  "pulmonary-fibrosis-foundation": ["pulmonary fibrosis foundation", "pff"],
  // ── musculoskeletal ──
  "mda-georgia": ["muscular dystrophy association georgia", "mda georgia"],
  "marfan-foundation-georgia": ["marfan foundation georgia"],
  "ehlers-danlos-georgia": ["ehlers danlos society georgia", "eds georgia"],
  // ── blood_disorders ──
  "hemophilia-of-georgia": ["hemophilia of georgia", "hog"],
  // ── sensory ──
  "cvi-atlanta": ["center for the visually impaired", "cvi atlanta"],
  "fighting-blindness-atlanta": ["foundation fighting blindness atlanta", "ffb atlanta"],
  gcdhh: ["georgia center for the deaf and hard of hearing", "gcdhh"],
  // ── womens_health ──
  "pcos-challenge": ["pcos challenge", "pcos challenge national"],
  "la-leche-league-georgia": ["la leche league georgia", "lll georgia"],
  "endometriosis-care-atlanta": ["center for endometriosis care atlanta", "endometriosis care"],
  "psi-georgia": ["postpartum support international georgia", "psi georgia"],
  // ── transplant ──
  "donate-life-georgia": ["donate life georgia"],
  "georgia-transplant-foundation": ["georgia transplant foundation", "gtf"],
  // ── pediatric_health ──
  "choa-community-events": ["childrens healthcare of atlanta", "choa", "children's healthcare"],
  "camp-twin-lakes": ["camp twin lakes"],
  "camp-sunshine-georgia": ["camp sunshine georgia"],
  "make-a-wish-georgia": ["make a wish georgia"],
  "berts-big-adventure": ["berts big adventure", "bert's big adventure"],
  "best-buddies-georgia": ["best buddies georgia"],
  "march-of-dimes-georgia": ["march of dimes georgia"],
  "ronald-mcdonald-house-atlanta": ["ronald mcdonald house atlanta", "rmhc atlanta"],
  "gigis-playhouse-atlanta": ["gigis playhouse atlanta", "gigi's playhouse"],
  "georgia-parent-support-network": ["georgia parent support network", "gpsn"],
  "special-olympics-georgia": ["special olympics georgia", "soga"],
  // ── patient_financial ──
  "patient-advocate-foundation": ["patient advocate foundation", "paf"],
  "healthwell-foundation": ["healthwell foundation"],
  // ── crisis_safety (additional) ──
  "afsp-georgia": ["american foundation for suicide prevention georgia", "afsp georgia"],
  "georgia-crisis-line": ["georgia crisis and access line", "gcal", "mygcal"],
  "aa-atlanta": ["alcoholics anonymous atlanta", "aa atlanta"],
  "aids-walk-atlanta": ["aids walk atlanta", "aids walk"],
  // ── hospital_community ──
  "piedmont-healthcare": ["piedmont healthcare"],
  "piedmonthealthcare-events": ["piedmont healthcare events"],
  "piedmont-classes": ["piedmont classes"],
  "piedmont-heart-conferences": ["piedmont heart conferences"],
  "piedmont-womens-heart": ["piedmont womens heart", "piedmont women's heart"],
  "piedmont-transplant": ["piedmont transplant support"],
  "piedmont-fitness": ["piedmont fitness centers", "piedmont fitness"],
  "piedmont-foundation": ["piedmont foundation events", "piedmont foundation"],
  "piedmont-auxiliary": ["piedmont auxiliary", "piedmont hospital auxiliary"],
  "piedmont-athens": ["piedmont athens spiritual care"],
  "piedmont-cme": ["piedmont cme", "piedmont continuing education"],
  "wellstar-community-events": ["wellstar health system", "wellstar community", "wellstar"],
  "northside-hospital-community": ["northside hospital community", "northside hospital classes"],
  "adventhealth-georgia": ["adventhealth georgia", "adventhealth gordon"],
  "nghs-community-events": ["northeast georgia health system", "nghs", "ngmc"],
};

function normalizePolicyText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMatchTerms(item: SupportSourcePolicyItem): string[] {
  const aliases = SUPPORT_POLICY_ALIASES[item.id] || [];
  return [item.id, item.name, ...aliases]
    .map((term) => normalizePolicyText(term))
    .filter(Boolean);
}

export function resolveSupportSourcePolicy(args: {
  slug?: string | null;
  name?: string | null;
}): SupportSourcePolicyItem | null {
  const slug = normalizePolicyText(args.slug);
  const name = normalizePolicyText(args.name);
  if (!slug && !name) return null;

  for (const item of SUPPORT_SOURCE_POLICY_ITEMS) {
    const terms = getMatchTerms(item);
    if (slug && terms.some((term) => slug === term || slug.includes(term))) {
      return item;
    }
  }

  for (const item of SUPPORT_SOURCE_POLICY_ITEMS) {
    const terms = getMatchTerms(item);
    if (name && terms.some((term) => name === term || name.includes(term))) {
      return item;
    }
  }

  return null;
}
