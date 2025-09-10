import React from 'react';

function ChapterList() {
  const playlistData = [
  {
    id: 1,
    title: "Class 12 Chapter 1 || Electric Charges and Fields 01 || Quantisation and Conservation of Charge",
    channel: "Physics Wallah - Alakh Pandey",
    duration: "40:13",
    thumbnail: "https://i.ytimg.com/vi/m5VbK66a254/hqdefault.jpg?sqp=-oaymwEmCKgBEF5IWvKriqkDGQgBFQAAiEIYAdgBAeIBCggYEAIYBjgBQAE=&rs=AOn4CLCt2rMJW2jZAYkcDi9wLQOGVkLSTw",
    selected: true
  },
  {
    id: 2,
    title: "Class 12 Chapter 1 || Electric Charges and Fields 01 || Quantisation and Conservation of Charge",
    channel: "Physics Wallah - Alakh Pandey",
    duration: "40:13",
    thumbnail: "https://i.ytimg.com/vi/m5VbK66a254/hqdefault.jpg?sqp=-oaymwEmCKgBEF5IWvKriqkDGQgBFQAAiEIYAdgBAeIBCggYEAIYBjgBQAE=&rs=AOn4CLCt2rMJW2jZAYkcDi9wLQOGVkLSTw",
    selected: false
  },
  {
    id: 3,
    title: "Class 12 Chapter 1 || Electric Charges and Fields 01 || Quantisation and Conservation of Charge",
    channel: "Physics Wallah - Alakh Pandey",
    duration: "40:13",
    thumbnail: "https://i.ytimg.com/vi/m5VbK66a254/hqdefault.jpg?sqp=-oaymwEmCKgBEF5IWvKriqkDGQgBFQAAiEIYAdgBAeIBCggYEAIYBjgBQAE=&rs=AOn4CLCt2rMJW2jZAYkcDi9wLQOGVkLSTw",
    selected: false
  },
  {
    id: 4,
    title: "Class 12 Chapter 1 || Electric Charges and Fields 01 || Quantisation and Conservation of Charge",
    channel: "Physics Wallah - Alakh Pandey",
    duration: "40:13",
    thumbnail: "https://i.ytimg.com/vi/m5VbK66a254/hqdefault.jpg?sqp=-oaymwEmCKgBEF5IWvKriqkDGQgBFQAAiEIYAdgBAeIBCggYEAIYBjgBQAE=&rs=AOn4CLCt2rMJW2jZAYkcDi9wLQOGVkLSTw",
    selected: false
  },
  {
    id: 5,
    title: "Class 12 Chapter 1 || Electric Charges and Fields 01 || Quantisation and Conservation of Charge",
    channel: "Physics Wallah - Alakh Pandey",
    duration: "40:13",
    thumbnail: "https://i.ytimg.com/vi/m5VbK66a254/hqdefault.jpg?sqp=-oaymwEmCKgBEF5IWvKriqkDGQgBFQAAiEIYAdgBAeIBCggYEAIYBjgBQAE=&rs=AOn4CLCt2rMJW2jZAYkcDi9wLQOGVkLSTw",
    selected: false
  },
  {
    id: 6,
    title: "Class 12 Chapter 1 || Electric Charges and Fields 01 || Quantisation and Conservation of Charge",
    channel: "Physics Wallah - Alakh Pandey",
    duration: "40:13",
    thumbnail: "https://i.ytimg.com/vi/m5VbK66a254/hqdefault.jpg?sqp=-oaymwEmCKgBEF5IWvKriqkDGQgBFQAAiEIYAdgBAeIBCggYEAIYBjgBQAE=&rs=AOn4CLCt2rMJW2jZAYkcDi9wLQOGVkLSTw",
    selected: false
  }
  ,
  {
    id: 7,
    title: "Class 12 Chapter 1 || Electric Charges and Fields 01 || Quantisation and Conservation of Charge",
    channel: "Physics Wallah - Alakh Pandey",
    duration: "40:13",
    thumbnail: "https://i.ytimg.com/vi/m5VbK66a254/hqdefault.jpg?sqp=-oaymwEmCKgBEF5IWvKriqkDGQgBFQAAiEIYAdgBAeIBCggYEAIYBjgBQAE=&rs=AOn4CLCt2rMJW2jZAYkcDi9wLQOGVkLSTw",
    selected: false
  }
  ,
  {
    id: 8,
    title: "Class 12 Chapter 1 || Electric Charges and Fields 01 || Quantisation and Conservation of Charge",
    channel: "Physics Wallah - Alakh Pandey",
    duration: "40:13",
    thumbnail: "https://i.ytimg.com/vi/m5VbK66a254/hqdefault.jpg?sqp=-oaymwEmCKgBEF5IWvKriqkDGQgBFQAAiEIYAdgBAeIBCggYEAIYBjgBQAE=&rs=AOn4CLCt2rMJW2jZAYkcDi9wLQOGVkLSTw",
    selected: false
  }
  ,
  {
    id: 9,
    title: "Class 12 Chapter 1 || Electric Charges and Fields 01 || Quantisation and Conservation of Charge",
    channel: "Physics Wallah - Alakh Pandey",
    duration: "40:13",
    thumbnail: "https://i.ytimg.com/vi/m5VbK66a254/hqdefault.jpg?sqp=-oaymwEmCKgBEF5IWvKriqkDGQgBFQAAiEIYAdgBAeIBCggYEAIYBjgBQAE=&rs=AOn4CLCt2rMJW2jZAYkcDi9wLQOGVkLSTw",
    selected: false
  }

];


  return (
    <div className='video-chapter'>
        <div className='chapter-head'>
            <div className='playlist-title'>
                <div className='chapter-title'>
                    <h3><a href=''>12 chapter 1 II Electri charges and Fields JEE MAINS/NEET</a></h3>
                    <p><a href=''>Physics Wallah - Alakh Pandey</a> <span>1 / 17</span></p>
                </div>
                <div className='chapter-close'>
                    <button>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12.7096 12L20.8596 20.15L20.1496 20.86L11.9996 12.71L3.84965 20.86L3.13965 20.15L11.2896 12L3.14965 3.85001L3.85965 3.14001L11.9996 11.29L20.1496 3.14001L20.8596 3.85001L12.7096 12Z" fill="black"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div className='playlist-action-menu'>
                <div className='start-action'>
                    <button>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M21.0002 13H22.0002V18L3.93023 18.03L6.55023 20.65L5.84023 21.36L1.99023 17.5L5.84023 13.65L6.55023 14.36L3.88023 17.03L21.0002 17V13ZM3.00023 7.00002L20.1202 6.97002L17.4502 9.64002L18.1602 10.35L22.0102 6.50002L18.1602 2.65002L17.4502 3.36002L20.0702 5.98002L2.00023 6.00002V11H3.00023V7.00002Z" fill="black"/>
                        </svg>
                    </button>
                    <button>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18.15 13.65L22 17.5L18.15 21.35L17.44 20.64L20.09 18H19C16.16 18 13.47 16.77 11.61 14.62L12.37 13.97C14.03 15.89 16.45 17 19 17H20.09L17.44 14.35L18.15 13.65ZM19 7.00003H20.09L17.44 9.65003L18.15 10.36L22 6.51003L18.15 2.66003L17.44 3.37003L20.09 6.00003H19C15.42 6.00003 12.14 7.95003 10.43 11.09L9.7 12.43C8.16 15.25 5.21 17 2 17V18C5.58 18 8.86 16.05 10.57 12.91L11.3 11.57C12.84 8.75003 15.79 7.00003 19 7.00003ZM8.59 9.98003L9.34 9.32003C7.49 7.21003 4.81 6.00003 2 6.00003V7.00003C4.52 7.00003 6.92 8.09003 8.59 9.98003Z" fill="black"/>
                        </svg>
                    </button>
                </div>
                <div className='end-action'>
                    <button>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 16.5C12.83 16.5 13.5 17.17 13.5 18C13.5 18.83 12.83 19.5 12 19.5C11.17 19.5 10.5 18.83 10.5 18C10.5 17.17 11.17 16.5 12 16.5ZM10.5 12C10.5 12.83 11.17 13.5 12 13.5C12.83 13.5 13.5 12.83 13.5 12C13.5 11.17 12.83 10.5 12 10.5C11.17 10.5 10.5 11.17 10.5 12ZM10.5 6C10.5 6.83 11.17 7.5 12 7.5C12.83 7.5 13.5 6.83 13.5 6C13.5 5.17 12.83 4.5 12 4.5C11.17 4.5 10.5 5.17 10.5 6Z" fill="black"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
        <div className="chapter-body">
          <ul>
            {playlistData.map((item) => (
              <li key={item.id}>
                <div className={`playlist-items ${item.selected ? 'selected' : ''}`}>
                  <a href="#">
                    <div className="playlist-drag-handle">{item.selected ? '▶' : item.id}</div>
                    <div className="thumbnail-container">
                      <img src={item.thumbnail} alt={item.title} />
                      <span>{item.duration}</span>
                    </div>
                    <div className="thumbnail-meta">
                      <h4>{item.title}</h4>
                      <span>{item.channel}</span>
                    </div>
                    <div className="thumbnail-action">
                      <button>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 16.5C12.83 16.5 13.5 17.17 13.5 18C13.5 18.83 12.83 19.5 12 19.5C11.17 19.5 10.5 18.83 10.5 18C10.5 17.17 11.17 16.5 12 16.5ZM10.5 12C10.5 12.83 11.17 13.5 12 13.5C12.83 13.5 13.5 12.83 13.5 12C13.5 11.17 12.83 10.5 12 10.5C11.17 10.5 10.5 11.17 10.5 12ZM10.5 6C10.5 6.83 11.17 7.5 12 7.5C12.83 7.5 13.5 6.83 13.5 6C13.5 5.17 12.83 4.5 12 4.5C11.17 4.5 10.5 5.17 10.5 6Z" fill="black"/>
                        </svg>
                      </button>
                    </div>
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </div>
    </div>
  );
}

export default ChapterList;

