6살 한국인 아이를 위한 교육 목적의 영어 회사 어플리케이션을 만들고 싶어.
어플리케이션은 웹앱이며, 동작 시나리오는 다음과 같아.(티쳐 - AI, 학생 - 이용자)
학생은 노트북 환경에서 이용할 예정이야.(마이크, 스피커 모두 노트북에 내장된 것 사용)

1) 학생(이용자)가 웹 어플리케이션 접근 시, 6살 한국인 아이 교육을 위한 랜덤 하게 주제를 선택(생성형 AI API 이용)
2) 생성형 AI API 를 이용하여, 티쳐의 질문 영어 스크립트를 생성(txt)(생성형 AI API 이용)
3) TTS(SpeechSynthesis API)를 이용하여 2번에서 생성한 영어 스크립트를 브라우져에서 재생
4) 학생(이용자)는 스피커를 통해 영어를 듣고, 마이크를 이용해 대답함(voice)
5) STT(SpeechRecognition API) 를 이용하여 학생(이용자)의 4번의 voice를 대답 영어 스크립트를 생성(txt)
6) 5번에서 생성한 대답 영어 txt를 생성형 AI 에게 전달(이전 3번에서 생성한 질문 영어 스크립트와 함께 전달) 7) 문법적이나 잘못된 대답을 하면 한국어로 교정 대답 스크립트 생성 / 정상적인 대답을 했으면 다음 질문 영어 스크립트 생성 8) 2 ~ 7 번 과정 반복

5번 과정의 STT를 인식률이 떨어지면 OpenAI Whisper 를 사용해서 Voice to Text 인식률을 높이고 싶어. 만약 Whisper 로 사용한다면 WASM 빌드를 사용해서 브라우져안에서 돌아가도록 계획하고 싶어.

사용자의 대화내용은 브라우져의 IndexDB 에 저장해서 관리하고 싶어.
IndexDB의 key는 날짜(yyyy-mm-dd)가 되고, value 는 Object 형태에 { topic: string, messsages: Array<{ sender: string, msg: string}>, summary: string | null} 가 들어갔으면해.
topic 은 1번에서 생성한 주제가 되고, messages 는 리스트인데 sender는 화자(티쳐 or 학생)이 되고, msg 는 스크립트 txt 내용이 들어가면되. 그리고 summary 는 messages 들의 요약이 들어가면 좋을 거 같아.
summary는 당일날 생성하는 것이 아닌 그 이후에 생성하는 정보야. 만약 2026-06-01일에 학생이 접속하게 되면 "2026-06-01" key로 { topic: '학교', messages: [{ sender: '티쳐', msg: 'Hello. Every one!'}], summary: null} 로 들어가게 될 거고. 2026-06-01 이후 날짜에 사용자가 접속을 하게 된다면, 처음 접속했을때 오늘 날짜 이전의 정보들을 불러와 summary 가 지정되어 있는지 확인 후, summary 가 지정이 안되어 있으면(null) messages 들을 요약하여 summary 를 만든다(생성형 AI API를 이용하여). summary 는 100글자 이내로 생성한다.

웹 어플리케이션 화면은 [임시 웹화면](test.html) 이야.

생성형 AI API는 openai 의 api 를 사용할 예정이야. public 서비스가 아니고 private 한 서비스라 웹 브라우져 환경에서 바로 openai api 를 호출할 예정이야.
해당 앱에서 AI Model 은 gpt-4.1-mini 모델을 사용할 예정이야.