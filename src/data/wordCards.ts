// 단어 맞추기 게임에 쓰이는 단어 카드 목록.
//
// 여기에 카드를 자유롭게 추가/수정하면 된다. 게임은 매 판마다 이 목록에서
// 무작위로 5장을 뽑아 5라운드를 진행한다. (카드가 5장 미만이면 있는 만큼만 진행)
//
// image 필드는 두 가지 방식 모두 지원한다.
//   1) 이모지 문자열         예: '🍎'
//   2) public 폴더 기준 경로  예: '/word-cards/apple.png'
//      → 프로젝트 루트의 `public/word-cards/` 에 이미지를 넣고 경로를 적으면 된다.
//
// answer 는 정답 영어 단어다. 소문자로 적는 것을 권장한다.
// (학생이 "It's an apple" 처럼 말해도 단어가 포함되면 정답 처리된다)

import type { WordCard } from '../types';

export const WORD_CARDS: WordCard[] = [
  { answer: 'apple', image: '🍎', ko: '사과' },
  { answer: 'banana', image: '🍌', ko: '바나나' },
  { answer: 'cat', image: '🐱', ko: '고양이' },
  { answer: 'dog', image: '🐶', ko: '강아지' },
  { answer: 'car', image: '🚗', ko: '자동차' },
  { answer: 'sun', image: '☀️', ko: '해' },
  { answer: 'fish', image: '🐟', ko: '물고기' },
  { answer: 'flower', image: '🌸', ko: '꽃' },
  { answer: 'bird', image: '🐦', ko: '새' },
  { answer: 'star', image: '⭐', ko: '별' },
];
