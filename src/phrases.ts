/**
 * Fixed English and Arabic versions of the clinic phrases, with hand-written
 * hangul readings. Keyed by the Korean line in PRESETS (plus a few pattern lines).
 *
 * Arabic is Modern Standard Arabic and deliberately gender-neutral: requests are
 * "الرجاء + verbal noun" and there is no "your", because imperatives and -k
 * endings change with the patient's gender.
 */
import type { PatientLang } from "./lang";
import { EXACT_KEYS, NEGATIVE_PATTERNS, PATTERNS, isNegated, normalize, stripPunct } from "./prepare";

export type Phrase = { text: string; reading: string };

type Row = [ko: string, en: string, enReading: string, ar: string, arReading: string];

const ROWS: Row[] = [
  ["안녕하세요?", "Hello.", "헬로우", "مرحبًا", "마르하반"],
  ["식사는 하셨나요?", "Have you eaten?", "해브 유 이튼?", "هل تم تناول الطعام؟", "할 탐마 타나울 앗타암?"],
  ["컨디션은 괜찮으세요?", "How are you feeling?", "하우 아 유 필링?", "كيف الحال اليوم؟", "카이팔 할 알야움?"],
  ["아프세요?", "Does it hurt?", "더즈 잇 허트?", "هل هناك ألم؟", "할 후나카 알람?"],
  ["어지러우세요?", "Do you feel dizzy?", "두 유 필 디지?", "هل هناك دوخة؟", "할 후나카 다우카?"],
  ["피곤하세요?", "Are you tired?", "아 유 타이어드?", "هل هناك تعب؟", "할 후나카 타아브?"],
  ["화장실 가고 싶으세요?", "Do you need the restroom?", "두 유 니드 더 레스트룸?", "هل هناك حاجة إلى الحمام؟", "할 후나카 하자 일랄 함맘?"],
  ["아프면 말씀해 주세요", "Please tell me if it hurts.", "플리즈 텔 미 이프 잇 허츠", "الرجاء إخباري عند الشعور بالألم", "아르라자 이크바리 인닷 슈우르 빌알람"],

  ["옮겨 앉아볼게요", "Let's move over and sit down.", "렛츠 무브 오버 앤 싯 다운", "سننتقل ونجلس الآن", "사난타낄 와나즐리스 알안"],
  ["제가 도와드릴게요", "I will help you.", "아이 윌 헬프 유", "سأقدم المساعدة", "사우깟딤 알무사아다"],
  ["일어나보세요", "Please try to stand up.", "플리즈 트라이 투 스탠드 업", "الرجاء محاولة الوقوف", "아르라자 무하왈라트 알우꾸프"],
  ["천천히 일어나세요", "Please get up slowly.", "플리즈 겟 업 슬로울리", "الرجاء النهوض ببطء", "아르라자 안누후드 비부트"],
  ["앉아보세요", "Please sit down.", "플리즈 싯 다운", "الرجاء الجلوس", "아르라자 알줄루스"],
  ["누워보세요", "Please lie down.", "플리즈 라이 다운", "الرجاء الاستلقاء", "아르라자 알이스틸까"],
  ["옆으로 돌아누워 보세요", "Please roll onto your side.", "플리즈 롤 온투 유어 사이드", "الرجاء الاستلقاء على الجانب", "아르라자 알이스틸까 알랄 자니브"],
  ["침대 끝에 앉아볼게요", "Let's sit on the edge of the bed.", "렛츠 싯 온 디 엣지 오브 더 베드", "سنجلس على حافة السرير", "사나즐리스 알라 하파트 앗사리르"],
  ["똑바로 앉으세요", "Please sit up straight.", "플리즈 싯 업 스트레이트", "الرجاء الجلوس باستقامة", "아르라자 알줄루스 비스티까마"],
  ["앞으로 숙이세요", "Please lean forward.", "플리즈 린 포워드", "الرجاء الانحناء إلى الأمام", "아르라자 알인히나 일랄 아맘"],
  ["엉덩이 들어보세요", "Please lift your hips.", "플리즈 리프트 유어 힙스", "الرجاء رفع الوركين", "아르라자 라프알 와리카인"],
  ["발을 바닥에 붙이세요", "Please put your feet flat on the floor.", "플리즈 풋 유어 핏 플랫 온 더 플로어", "الرجاء وضع القدمين على الأرض", "아르라자 와드알 까다마인 알랄 아르드"],

  ["팔 들어보세요", "Please raise your arm.", "플리즈 레이즈 유어 암", "الرجاء رفع الذراع", "아르라자 라프앗 디라아"],
  ["약한 쪽 팔을 들어보세요", "Please raise your weaker arm.", "플리즈 레이즈 유어 위커 암", "الرجاء رفع الذراع الضعيفة", "아르라자 라프앗 디라앗 다이파"],
  ["밀어보세요", "Please push.", "플리즈 푸시", "الرجاء الدفع باليد", "아르라자 앗다프으 빌야드"],
  ["당겨보세요", "Please pull.", "플리즈 풀", "الرجاء السحب باليد", "아르라자 앗사흐브 빌야드"],
  ["올려보세요", "Please lift it up.", "플리즈 리프트 잇 업", "الرجاء الرفع إلى أعلى", "아르라자 아르라프으 일라 아을라"],
  ["내려보세요", "Please lower it.", "플리즈 로워 잇", "الرجاء الإنزال إلى أسفل", "아르라자 알인잘 일라 아스팔"],
  ["손을 쥐어보세요", "Please make a fist.", "플리즈 메이크 어 피스트", "الرجاء قبض اليد", "아르라자 까브달 야드"],
  ["손을 펴보세요", "Please open your hand.", "플리즈 오픈 유어 핸드", "الرجاء فتح اليد", "아르라자 파트할 야드"],
  ["제 손을 꽉 잡아보세요", "Please squeeze my hand tightly.", "플리즈 스퀴즈 마이 핸드 타이틀리", "الرجاء الضغط على يدي بقوة", "아르라자 앗다그트 알라 야디 비꾸와"],
  ["팔꿈치를 펴세요", "Please straighten your elbow.", "플리즈 스트레이튼 유어 엘보우", "الرجاء فرد الكوع", "아르라자 파르달 쿠으"],
  ["어깨에 힘을 빼세요", "Please relax your shoulders.", "플리즈 릴랙스 유어 숄더즈", "الرجاء إرخاء الكتفين", "아르라자 이르카알 카티파인"],

  ["다리 들어보세요", "Please raise your leg.", "플리즈 레이즈 유어 레그", "الرجاء رفع الساق", "아르라자 라프앗 사끄"],
  ["뻥 차보세요", "Please kick your leg forward.", "플리즈 킥 유어 레그 포워드", "الرجاء الركل إلى الأمام", "아르라자 아르라클 일랄 아맘"],
  ["무릎 펴세요", "Please straighten your knee.", "플리즈 스트레이튼 유어 니", "الرجاء فرد الركبة", "아르라자 파르다르 루크바"],
  ["무릎을 굽히세요", "Please bend your knee.", "플리즈 벤드 유어 니", "الرجاء ثني الركبة", "아르라자 사니 아르루크바"],
  ["발목을 위로 당기세요", "Please pull your foot up toward you.", "플리즈 풀 유어 풋 업 투워드 유", "الرجاء رفع مقدمة القدم إلى أعلى", "아르라자 라프으 무깟디마트 알까담 일라 아을라"],
  ["약한 쪽 다리에 체중을 실어보세요", "Please put weight on your weaker leg.", "플리즈 풋 웨이트 온 유어 위커 레그", "الرجاء وضع الوزن على الساق الضعيفة", "아르라자 와드알 와즌 알랏 사낏 다이파"],
  ["난간을 잡으세요", "Please hold the handrail.", "플리즈 홀드 더 핸드레일", "الرجاء الإمساك بالدرابزين", "아르라자 알임사크 빗다라브진"],
  ["지팡이를 잡으세요", "Please hold the cane.", "플리즈 홀드 더 케인", "الرجاء الإمساك بالعصا", "아르라자 알임사크 빌아사"],
  ["한 발 앞으로 내딛으세요", "Please take one step forward.", "플리즈 테이크 원 스텝 포워드", "الرجاء التقدم خطوة واحدة", "아르라자 앗타깟둠 쿠트와 와히다"],
  ["천천히 걸어볼게요", "Let's walk slowly.", "렛츠 워크 슬로울리", "سنمشي ببطء", "사남시 비부트"],
  ["넘어지지 않게 잡고 있을게요", "I'm holding you so you don't fall.", "아임 홀딩 유 소우 유 돈트 폴", "أنا أمسك جيدًا لتجنب السقوط", "아나 움시크 자이이단 리타잔누브 앗수꾸트"],

  ["숨 크게 쉬세요", "Please take a deep breath in.", "플리즈 테이크 어 딥 브레스 인", "الرجاء أخذ نفس عميق", "아르라자 아크드 나파스 아미끄"],
  ["깊게 들이쉬고 내쉬세요", "Please breathe in deeply, then breathe out.", "플리즈 브리드 인 디플리, 덴 브리드 아웃", "الرجاء أخذ نفس عميق ثم الزفير", "아르라자 아크드 나파스 아미끄 숨맛 자피르"],
  ["배에 힘을 주세요", "Please tighten your stomach muscles.", "플리즈 타이튼 유어 스토먹 머슬즈", "الرجاء شد عضلات البطن", "아르라자 샷드 아달라틀 바튼"],
  ["힘을 빼세요", "Please relax.", "플리즈 릴랙스", "الرجاء الاسترخاء", "아르라자 알이스티르카"],
  ["그대로 멈춰 주세요", "Please hold it there.", "플리즈 홀드 잇 데어", "الرجاء الثبات على هذا الوضع", "아르라자 앗사바트 알라 하달 와드으"],
  ["저를 보세요", "Please look at me.", "플리즈 룩 앳 미", "الرجاء النظر إليّ", "아르라자 안나자르 일라이야"],
  ["하나, 둘, 셋", "One, two, three.", "원, 투, 쓰리", "واحد، اثنان، ثلاثة", "와히드, 이스난, 살라사"],
  ["열 번 반복하세요", "Please repeat ten times.", "플리즈 리핏 텐 타임즈", "الرجاء التكرار عشر مرات", "아르라자 앗타크라르 아슈르 마르라트"],
  ["다시 한번 해보세요", "Please try once more.", "플리즈 트라이 원스 모어", "الرجاء المحاولة مرة أخرى", "아르라자 알무하왈라 마르라 우크라"],
  ["조금만 더요", "Just a little more.", "저스트 어 리틀 모어", "بقي القليل فقط", "바끼얄 깔릴 파까트"],
  ["통증이 있으면 멈추세요", "Please stop if you feel pain.", "플리즈 스탑 이프 유 필 페인", "الرجاء التوقف عند الشعور بالألم", "아르라자 앗타왓꾸프 인닷 슈우르 빌알람"],

  ["좋아요", "Good.", "굿", "جيد", "자이이드"],
  ["잘하셨어요", "Well done.", "웰 던", "عمل رائع", "아말 라이으"],
  ["잠깐 쉬었다 할게요", "Let's take a short break.", "렛츠 테이크 어 쇼트 브레이크", "سنستريح قليلًا", "사나스타리흐 깔릴란"],
  ["오늘은 여기까지입니다", "That's all for today.", "댓츠 올 포 투데이", "هذا كل شيء لليوم", "하다 쿨루 샤이 릴야움"],
  ["수고하셨습니다", "Thank you for your hard work today.", "땡큐 포 유어 하드 워크 투데이", "شكرًا على الجهد اليوم", "슈크란 알랄 주흐드 알야움"],

  ["잘 주무셨어요?", "Did you sleep well?", "디드 유 슬립 웰?", "هل كان النوم جيدًا؟", "할 카난 나움 자이이단?"],
  ["약은 드셨어요?", "Have you taken your medicine?", "해브 유 테이큰 유어 메디슨?", "هل تم تناول الدواء؟", "할 탐마 타나울룻 다와?"],
  ["혈압을 재볼게요", "Let me check your blood pressure.", "렛 미 체크 유어 블러드 프레셔", "سأقيس ضغط الدم", "사아끼수 다그탓 담"],
  ["힘이 안 들어가세요?", "Is it hard to use your strength?", "이즈 잇 하드 투 유즈 유어 스트렝스?", "هل هناك صعوبة في استخدام القوة؟", "할 후나카 수우바 피 이스티크다밀 꾸와?"],
  ["턱을 당기세요", "Please tuck your chin in.", "플리즈 턱 유어 친 인", "الرجاء سحب الذقن إلى الداخل", "아르라자 사흐붓 다끈 일랏 다킬"],
  ["배를 내밀지 마세요", "Please do not push your stomach out.", "플리즈 두 낫 푸시 유어 스토먹 아웃", "الرجاء عدم دفع البطن إلى الأمام", "아르라자 아담 다프일 바튼 일랄 아맘"],
  ["다리를 꼬지 마세요", "Please do not cross your legs.", "플리즈 두 낫 크로스 유어 레그즈", "الرجاء عدم وضع ساق على ساق", "아르라자 아담 와드이 사낀 알라 사끄"],

  ["계단을 올라갈 때는 안 아픈 다리부터 올리세요", "Going up the stairs, start with the leg that does not hurt.", "고잉 업 더 스테어즈, 스타트 위드 더 레그 댓 더즈 낫 허트", "عند صعود الدرج، الرجاء البدء بالساق السليمة", "인다 수우딧 다라즈, 아르라자 알바드 빗사낏 살리마"],
  ["계단을 내려갈 때는 아픈 다리부터 내리세요", "Going down the stairs, start with the leg that hurts.", "고잉 다운 더 스테어즈, 스타트 위드 더 레그 댓 허츠", "عند نزول الدرج، الرجاء البدء بالساق المؤلمة", "인다 누줄릿 다라즈, 아르라자 알바드 빗사낄 무을리마"],
  ["올라갈 때는 강한 다리부터 올리세요", "Going up, start with your stronger leg.", "고잉 업, 스타트 위드 유어 스트롱거 레그", "عند الصعود، الرجاء البدء بالساق القوية", "인닷 수우드, 아르라자 알바드 빗사낄 까위야"],
  ["내려갈 때는 약한 다리부터 내리세요", "Going down, start with your weaker leg.", "고잉 다운, 스타트 위드 유어 위커 레그", "عند النزول، الرجاء البدء بالساق الضعيفة", "인단 누줄, 아르라자 알바드 빗사낏 다이파"],
  ["지팡이를 먼저 짚으세요", "Please move the cane first.", "플리즈 무브 더 케인 퍼스트", "الرجاء تقديم العصا أولًا", "아르라자 타끄디말 아사 아울란"],
  ["지팡이, 약한 다리, 강한 다리 순서로 걸으세요", "Cane first, then the weaker leg, then the stronger leg.", "케인 퍼스트, 덴 더 위커 레그, 덴 더 스트롱거 레그", "العصا أولًا، ثم الساق الضعيفة، ثم الساق القوية", "알아사 아울란, 숨맛 사꾸앗 다이파, 숨맛 사꿀 까위야"],
  ["뒤꿈치부터 디디세요", "Please put your heel down first.", "플리즈 풋 유어 힐 다운 퍼스트", "الرجاء وضع الكعب على الأرض أولًا", "아르라자 와드알 카읍 알랄 아르드 아울란"],
  ["서두르지 마세요", "Please do not rush.", "플리즈 두 낫 러시", "الرجاء عدم الاستعجال", "아르라자 아다밀 이스티으잘"],
  ["혼자 일어나지 마세요", "Please do not stand up alone.", "플리즈 두 낫 스탠드 업 얼론", "الرجاء عدم الوقوف دون مساعدة", "아르라자 아다밀 우꾸프 두나 무사아다"],
  ["아직 체중을 실으면 안 돼요", "Please do not put weight on it yet.", "플리즈 두 낫 풋 웨이트 온 잇 옛", "الرجاء عدم وضع الوزن عليها الآن", "아르라자 아담 와드일 와즌 알라이하 알안"],
  ["휠체어 브레이크를 잠그세요", "Please lock the wheelchair brakes.", "플리즈 락 더 휠체어 브레이크스", "الرجاء قفل مكابح الكرسي المتحرك", "아르라자 까플 마카비힐 쿠르시일 무타하르릭"],
  ["발판을 올리세요", "Please lift the footrest.", "플리즈 리프트 더 풋레스트", "الرجاء رفع مسند القدم", "아르라자 라프으 마스나딜 까담"],
  ["보조기를 신을게요", "Let's put on the brace.", "렛츠 풋 온 더 브레이스", "سنضع الدعامة الآن", "사나다웃 디아마 알안"],

  // "Don't" lines (NEGATIVE_PATTERNS).
  ["숨을 참지 마세요", "Please do not hold your breath.", "플리즈 두 낫 홀드 유어 브레스", "الرجاء عدم حبس النفس", "아르라자 아담 합스 안나파스"],
  ["숨을 참지 말고 편하게 쉬세요", "Please do not hold your breath. Breathe comfortably.", "플리즈 두 낫 홀드 유어 브레스. 브리드 컴포터블리", "الرجاء عدم حبس النفس والتنفس براحة", "아르라자 아담 합스 안나파스 왓타낫푸스 비라하"],
  ["엉덩이를 들지 마세요", "Please do not lift your hips.", "플리즈 두 낫 리프트 유어 힙스", "الرجاء عدم رفع الوركين", "아르라자 아담 라프알 와리카인"],
  ["배에 힘을 주지 마세요", "Please do not tighten your stomach.", "플리즈 두 낫 타이튼 유어 스토먹", "الرجاء عدم شد عضلات البطن", "아르라자 아담 샷드 아달라틀 바튼"],
  ["어깨에 힘을 빼지 마세요", "Please do not relax your shoulders.", "플리즈 두 낫 릴랙스 유어 숄더즈", "الرجاء عدم إرخاء الكتفين", "아르라자 아담 이르카알 카티파인"],
  ["허리를 숙이지 마세요", "Please do not bend forward at the waist.", "플리즈 두 낫 벤드 포워드 앳 더 웨이스트", "الرجاء عدم ثني الظهر إلى الأمام", "아르라자 아담 사니 앗자흐르 일랄 아맘"],
  ["돌아눕지 마세요", "Please do not roll onto your side.", "플리즈 두 낫 롤 온투 유어 사이드", "الرجاء عدم الاستلقاء على الجانب", "아르라자 아담 알이스틸까 알랄 자니브"],

  // Lines reached only through PATTERNS.
  ["숨을 참으세요", "Please hold your breath.", "플리즈 홀드 유어 브레스", "الرجاء حبس النفس", "아르라자 합스 안나파스"],
  ["허리를 숙이세요", "Please bend forward at the waist.", "플리즈 벤드 포워드 앳 더 웨이스트", "الرجاء ثني الظهر إلى الأمام", "아르라자 사니 앗자흐르 일랄 아맘"],
  ["반대쪽으로 돌아누우세요", "Please roll over onto your other side.", "플리즈 롤 오버 온투 유어 아더 사이드", "الرجاء الاستدارة إلى الجانب الآخر", "아르라자 알이스티다라 일랄 자니빌 아카르"],
];

const BY_KO = new Map<string, Row>(ROWS.map((row) => [row[0], row]));


/** The table entry for one Korean line. */
export function pick(ko: string, lang: PatientLang): Phrase | null {
  const row = BY_KO.get(ko);
  if (!row || lang === "ja") return null;
  return lang === "en" ? { text: row[1], reading: row[2] } : { text: row[3], reading: row[4] };
}

/** Fixed English/Arabic line for a Korean sentence, or null when it must go to the translator. */
export function fixedPhrase(korean: string, lang: PatientLang): Phrase | null {
  if (lang === "ja") return null;
  const original = normalize(korean);
  const compact = original.replace(/ /g, "");
  const key = EXACT_KEYS.get(original) ?? EXACT_KEYS.get(compact) ?? EXACT_KEYS.get(stripPunct(original));
  if (key) return pick(key, lang);
  for (const pattern of isNegated(original) ? NEGATIVE_PATTERNS : PATTERNS) {
    if (pattern.re.test(original) || pattern.re.test(compact)) return pick(pattern.key, lang);
  }
  return null;
}
